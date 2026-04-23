import { buildProviderCandidates } from "@/lib/hashtag-paste-intake/provider-candidates";
import { parseHashtagPasteRequest } from "@/lib/hashtag-paste-intake/parser";
import type { HashtagPasteIntakeRequest, ProviderCandidate } from "@/lib/hashtag-paste-intake/types";
import { normalizeBuildUploadRecords } from "./build";
import { adaptUploadRecords } from "@/lib/operators/upload-adapter";
import { fetchCandidatePage } from "@/lib/operators/page-fetch";
import { extractVagaroDirectoryListings } from "@/lib/operators/domain-parsers/vagaro";
import { enqueueDoraValidationForCandidate } from "@/lib/source-intake/dora-queue";
import { enqueueSocialDiscoveryForCandidate } from "@/lib/source-intake/social-queue";
import {
  createSourceIntake,
  listParsedCandidates,
  listSourceIntakes,
  saveParsedCandidates,
  updateSourceIntake,
} from "@/lib/source-intake/store";
import type { ParsedCandidateRow, ParseConfidence, SourceType } from "@/lib/source-intake/types";
import type { BuildSourceType } from "./types";
import { listDoraQueueByIntakeId, listSocialQueueByIntakeId } from "@/lib/source-intake/phase2-store";
import {
  buildFingerprintNote,
  buildSubmissionFingerprint,
  isRecentIsoWithinWindow,
  parseBuildFingerprintNote,
} from "./dedupe";
import {
  normalizeCanonicalCategory,
  normalizedTextFingerprint,
  parseInstagramUrlIdentity,
  pickMostCommonNonEmpty,
  toInstagramProfileUrl,
} from "./normalization";

export type BuildQueueSummary = {
  intakeId: string;
  candidatesCreated: number;
  doraQueued: number;
  socialQueued: number;
};

type PreparedCandidateSet = {
  sourceUrl?: string;
  city?: string;
  candidates: ParsedCandidateRow[];
};

type CandidateDraft = Omit<ParsedCandidateRow, "id" | "intakeId" | "ordinal">;

function splitDisplayName(displayName: string): { firstName?: string; lastName?: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return {};
  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
  };
}

function confidenceFromProvider(value: ProviderCandidate["confidence"]): ParseConfidence {
  if (value === "High") return "high";
  if (value === "Medium") return "medium";
  return "low";
}

function mapBuildSourceType(sourceType: BuildSourceType): SourceType {
  if (sourceType === "Instagram") return "instagram_bio";
  if (sourceType === "URL") return "team_page";
  return "manual_field_note";
}

function candidateNameFromProvider(candidate: ProviderCandidate): string {
  const displayName = candidate.displayName?.trim();
  if (displayName) return displayName;
  return candidate.handle.replace(/^@/, "").replace(/[._]/g, " ").trim() || candidate.handle;
}

function instagramSignalType(candidate: ProviderCandidate): "provider" | "client_tagged" | "unknown" {
  if (candidate.providerSignalCount >= 1) return "provider";
  if (candidate.clientSignalCount >= 1 || candidate.taggedByCount >= 1) return "client_tagged";
  return "unknown";
}

function toCaptionSnippet(value?: string): string | undefined {
  const text = (value || "").trim().replace(/\s+/g, " ");
  if (!text) return undefined;
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function isUsableInstagramDisplayName(value?: string): boolean {
  const text = (value || "").trim();
  if (!text) return false;
  if (text.length > 50) return false;
  if (text.includes(",") || text.includes("!")) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 5) return false;
  if (/\b(love|work|best|book|booking|tag|follow|tech is)\b/i.test(text)) return false;
  return true;
}

function candidateRowsFromInstagram(intakeId: string, rawText: string): ParsedCandidateRow[] {
  const request: HashtagPasteIntakeRequest = {
    platform: "instagram",
    rawText,
  };
  const { parsedPosts } = parseHashtagPasteRequest(request);
  const providerCandidates = buildProviderCandidates(parsedPosts, request);
  const postMap = new Map(parsedPosts.map((post) => [post.id, post]));

  return providerCandidates.map((candidate, index) => {
    const providerOwnedName = parsedPosts.find(
      (post) => post.handle?.toLowerCase() === candidate.handle.toLowerCase() && post.inferredType === "provider"
    )?.displayName;
    const chosenDisplayName = isUsableInstagramDisplayName(providerOwnedName)
      ? providerOwnedName
      : isUsableInstagramDisplayName(candidate.displayName)
        ? candidate.displayName
        : undefined;
    const displayName =
      chosenDisplayName?.trim() ||
      candidate.handle.replace(/^@/, "").replace(/[._]/g, " ").trim() ||
      candidateNameFromProvider(candidate);
    const parts = splitDisplayName(displayName);
    const evidenceBlocks = candidate.evidencePostIds
      .map((postId) => postMap.get(postId)?.rawBlock)
      .filter((value): value is string => Boolean(value));
    const evidencePosts = candidate.evidencePostIds
      .map((postId) => postMap.get(postId))
      .filter((value): value is NonNullable<typeof value> => Boolean(value));
    const captionSnippet = toCaptionSnippet(evidencePosts.map((post) => post.caption).find(Boolean));
    return {
      id: `${intakeId}_${candidate.id}`,
      intakeId,
      ordinal: index + 1,
      rawBlock: evidenceBlocks.join("\n\n") || `@${candidate.handle}`,
      displayName,
      firstName: parts.firstName,
      lastName: parts.lastName,
      instagramHandle: candidate.handle,
      instagramProfileUrl: toInstagramProfileUrl(candidate.handle),
      captionSnippet,
      signalType: instagramSignalType(candidate),
      serviceHint: candidate.serviceHint,
      geoHint: candidate.geoHint,
      // Preserve the strongest known provider/service identity, but keep category conservative.
      roleLabel: normalizeCanonicalCategory(candidate.serviceHint),
      parseConfidence: confidenceFromProvider(candidate.confidence),
      parseWarnings: candidate.reasons.length ? undefined : ["limited_instagram_signal"],
      reviewAction: "pending",
    } satisfies ParsedCandidateRow;
  });
}

function prepareInstagramCandidates(intakeId: string, rawText: string): PreparedCandidateSet {
  const request: HashtagPasteIntakeRequest = {
    platform: "instagram",
    rawText,
  };
  const { parsedPosts } = parseHashtagPasteRequest(request);
  const providerCandidates = buildProviderCandidates(parsedPosts, request);
  const candidates = candidateRowsFromInstagram(intakeId, rawText);
  const city = pickMostCommonNonEmpty(providerCandidates.map((candidate) => candidate.geoHint));
  const providerHandle = providerCandidates[0]?.handle || parsedPosts.find((post) => post.inferredType === "provider")?.handle;
  return {
    sourceUrl: toInstagramProfileUrl(providerHandle),
    city,
    candidates,
  };
}

function isVagaroProfessionalsResultsUrl(value?: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return (host === "vagaro.com" || host === "www.vagaro.com") && parsed.pathname.toLowerCase().startsWith("/professionals/");
  } catch {
    return false;
  }
}

async function expandVagaroDirectoryCandidates(row: {
  name?: string;
  city?: string;
  category?: string;
  website?: string;
  booking?: string;
  sourceUrl?: string;
  raw?: unknown;
}): Promise<CandidateDraft[] | null> {
  const candidateUrl = row.sourceUrl || row.website || row.booking;
  if (!isVagaroProfessionalsResultsUrl(candidateUrl)) return null;

  const fetched = await fetchCandidatePage(candidateUrl, { timeoutMs: 15000 });
  if (!fetched.html) return null;

  const listings = extractVagaroDirectoryListings(fetched.finalUrl || candidateUrl, fetched.html);
  if (!listings.length) return null;

  return listings.map((listing) => {
    const parts = splitDisplayName(listing.displayName);
    const rawBlock = JSON.stringify(
      {
        sourceUrl: candidateUrl,
        listingUrl: listing.profileUrl,
        displayName: listing.displayName,
        businessName: listing.businessName,
        city: listing.city,
        state: listing.state,
        location: listing.location,
        serviceHint: listing.serviceHint,
        ratingSummary: listing.ratingSummary,
        sourceNote: listing.sourceNote,
        pageClassification: listing.pageClassification,
      },
      null,
      2
    );
    const warnings = ["vagaro_directory_results"];
    if (!listing.city) warnings.push("missing_city");

    return {
      rawBlock,
      displayName: listing.displayName,
      firstName: parts.firstName,
      lastName: parts.lastName,
      roleLabel: normalizeCanonicalCategory(listing.serviceHint || row.category),
      parseConfidence: listing.businessName && listing.city ? "high" : "medium",
      parseWarnings: warnings,
      reviewAction: "pending",
    } satisfies CandidateDraft;
  });
}

async function prepareUploadCandidates(
  intakeId: string,
  sourceType: Exclude<BuildSourceType, "Instagram">,
  rawText: string
): Promise<PreparedCandidateSet> {
  const records = normalizeBuildUploadRecords(sourceType, rawText);
  const adapted = adaptUploadRecords(records);
  const candidateDrafts = (
    await Promise.all(
      adapted.sourceRecords.map(async (row, index) => {
        const vagaroListings = sourceType === "URL" ? await expandVagaroDirectoryCandidates(row) : null;
        if (vagaroListings?.length) return vagaroListings;

        const instagramIdentity =
          sourceType === "URL" ? parseInstagramUrlIdentity(row.instagram || row.sourceUrl || row.website) : null;
        const displayName =
          row.name?.trim() ||
          instagramIdentity?.displayNameFallback ||
          (instagramIdentity ? "Instagram URL" : undefined) ||
          row.instagram ||
          row.website ||
          row.booking ||
          `Candidate ${index + 1}`;
        const parts = splitDisplayName(displayName);
        const rawBlock =
          row.raw && typeof row.raw === "object" && "original" in row.raw
            ? JSON.stringify((row.raw as { original?: unknown }).original ?? row.raw, null, 2)
            : JSON.stringify(row, null, 2);
        const warnings: string[] = [];
        if (!row.city) warnings.push("missing_city");
        if (!row.address) warnings.push("missing_address");
        if (instagramIdentity) warnings.push("instagram_url_identity_source");

        return [
          {
            rawBlock,
            displayName,
            firstName: parts.firstName,
            lastName: parts.lastName,
            instagramHandle: instagramIdentity?.instagramHandle,
            instagramProfileUrl:
              instagramIdentity?.instagramProfileUrl || toInstagramProfileUrl(row.instagram || row.sourceUrl),
            signalType: instagramIdentity ? "unknown" : undefined,
            roleLabel: normalizeCanonicalCategory(row.category),
            parseConfidence:
              row.name && (row.city || row.address)
                ? "high"
                : row.name || instagramIdentity ? "medium" : "low",
            parseWarnings: warnings.length ? warnings : undefined,
            reviewAction: "pending",
          } satisfies CandidateDraft,
        ];
      })
    )
  ).flat();

  const candidates = candidateDrafts.map((candidate, index) => ({
    id: `${intakeId}_cand_${String(index + 1).padStart(2, "0")}`,
    intakeId,
    ordinal: index + 1,
    ...candidate,
  }));

  return {
    sourceUrl: adapted.sourceRecords.map((row) => toInstagramProfileUrl(row.instagram) || row.website || row.booking).find(Boolean),
    city: pickMostCommonNonEmpty(adapted.sourceRecords.map((row) => row.city)),
    candidates,
  };
}

function dedupeCandidates(candidates: ParsedCandidateRow[]): ParsedCandidateRow[] {
  const seen = new Set<string>();
  const deduped: ParsedCandidateRow[] = [];

  for (const candidate of candidates) {
    // Build-level candidate dedupe prevents duplicate queue work for the same normalized identity/raw block pair.
    const key = normalizedTextFingerprint([candidate.displayName, candidate.rawBlock]);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ ...candidate, ordinal: deduped.length + 1 });
  }

  return deduped;
}

async function summarizeExistingIntake(intakeId: string): Promise<BuildQueueSummary> {
  const [candidates, doraQueue, socialQueue] = await Promise.all([
    listParsedCandidates(intakeId),
    listDoraQueueByIntakeId(intakeId),
    listSocialQueueByIntakeId(intakeId),
  ]);
  return {
    intakeId,
    candidatesCreated: candidates.length,
    doraQueued: doraQueue.length,
    socialQueued: socialQueue.length,
  };
}

export async function persistBuildSubmissionToValidationQueue(args: {
  sourceType: BuildSourceType;
  rawText: string;
}): Promise<BuildQueueSummary> {
  const fingerprint = buildSubmissionFingerprint(args.sourceType, args.rawText);
  const recentDuplicates = (await listSourceIntakes()).filter(
    (intake) =>
      intake.status !== "failed" &&
      intake.sourceLabel === `Build ${args.sourceType}` &&
      parseBuildFingerprintNote(intake.notes) === fingerprint &&
      isRecentIsoWithinWindow(intake.submittedAt)
  );
  for (const recentDuplicate of recentDuplicates) {
    const summary = await summarizeExistingIntake(recentDuplicate.id);
    if (summary.candidatesCreated > 0 || summary.doraQueued > 0 || summary.socialQueued > 0) {
      return summary;
    }
  }

  const intakeIdSeed = `pending_${Date.now().toString(36)}`;
  const prepared =
    args.sourceType === "Instagram"
      ? prepareInstagramCandidates(intakeIdSeed, args.rawText)
      : await prepareUploadCandidates(intakeIdSeed, args.sourceType, args.rawText);

  const intake = await createSourceIntake({
    sourceLabel: `Build ${args.sourceType}`,
    sourceType: mapBuildSourceType(args.sourceType),
    sourceUrl: prepared.sourceUrl,
    city: prepared.city,
    notes: buildFingerprintNote(fingerprint),
    rawText: args.rawText,
  });

  const candidates = dedupeCandidates(
    (args.sourceType === "Instagram"
      ? prepareInstagramCandidates(intake.id, args.rawText)
      : await prepareUploadCandidates(intake.id, args.sourceType, args.rawText)
    ).candidates
  );

  if (!candidates.length) {
    await updateSourceIntake(intake.id, { status: "failed" });
    throw new Error("no_validation_candidates_created");
  }

  await saveParsedCandidates(intake.id, candidates);
  await updateSourceIntake(intake.id, {
    status: "parsed",
    parseSummary: {
      totalCandidates: candidates.length,
      parsedAt: new Date().toISOString(),
    },
  });

  let doraQueued = 0;
  let socialQueued = 0;
  for (const candidate of candidates) {
    await enqueueDoraValidationForCandidate({
      intakeId: intake.id,
      candidateId: candidate.id,
      sourceLabel: intake.sourceLabel,
      sourceType: intake.sourceType,
      sourceUrl: intake.sourceUrl,
      facilityId: intake.facilityId,
      facilityName: intake.facilityName,
      city: intake.city,
      state: intake.state,
      displayName: candidate.displayName,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
    });
    doraQueued += 1;

    await enqueueSocialDiscoveryForCandidate({
      intakeId: intake.id,
      candidateId: candidate.id,
      sourceLabel: intake.sourceLabel,
      sourceType: intake.sourceType,
      sourceUrl: intake.sourceUrl,
      facilityId: intake.facilityId,
      facilityName: intake.facilityName,
      city: intake.city,
      state: intake.state,
      displayName: candidate.displayName,
    });
    socialQueued += 1;
  }

  return {
    intakeId: intake.id,
    candidatesCreated: candidates.length,
    doraQueued,
    socialQueued,
  };
}
