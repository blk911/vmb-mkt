import fs from "node:fs";
import path from "node:path";
import { appendEvidence } from "@/lib/evidence/store";
import { sourceRecordsToEvidence } from "@/lib/evidence/ingest";
import { runAcquisition } from "@/lib/operators/run-acquisition";
import type { SourceRecord } from "@/lib/operators/types";
import { runGoogleSearch } from "@/lib/social-targets/operator-harvest/query-executor";
import { buildDirectoryBackedSurfacePromotionQueries } from "./promotion-queries";
import { loadResolverRegistry } from "./registry-store";
import { runResolver } from "./run-resolver";
import { selectDirectoryBackedPromotionCandidates } from "./directory-backed-promotion-selector";
import type { ResolverOperator } from "./types";

const SUMMARY_PATH = path.join(process.cwd(), "runtime-data/directory_backed_surface_promotion_summary.json");

type PromotionEvidenceGain = {
  instagram: boolean;
  booking: boolean;
  website: boolean;
};

function inferSourceFromUrl(url: string): SourceRecord["source"] {
  const lower = url.toLowerCase();
  if (lower.includes("instagram.com")) return "instagram";
  if (/(booksy|vagaro|glossgenius|styleseat|fresha|square\.site|squareup)/.test(lower)) return "booking";
  if (/(yelp|yellowpages|foursquare|mapquest|google\.)/.test(lower)) return "directory";
  return "website";
}

function toCandidateRecord(input: {
  operator: ResolverOperator;
  url: string;
  query: string;
  snippet?: string;
  strength: number;
}): SourceRecord {
  return {
    source: inferSourceFromUrl(input.url),
    operatorType: input.operator.operatorType || "operator",
    sourceUrl: input.url,
    name: input.operator.canonicalName,
    city: input.operator.canonicalCity,
    address: input.operator.canonicalAddress,
    phone: input.operator.canonicalPhone,
    website: input.operator.canonicalWebsite,
    booking: input.operator.canonicalBooking,
    instagram: input.operator.canonicalInstagram,
    category: input.operator.category,
    parentContainerId: input.operator.parentContainerId,
    parentContainerName: input.operator.parentContainerName,
    evidenceType: "direct_operator",
    raw: {
      from: "directory_backed_surface_promotion",
      operatorId: input.operator.id,
      query: input.query,
      snippet: input.snippet,
      candidateStrength: input.strength,
      createdAt: Date.now(),
    },
    extracted: {
      promotionMethod: "directory_backed_surface_promotion",
      operatorId: input.operator.id,
      operatorType: input.operator.operatorType || "operator",
      parentContainerId: input.operator.parentContainerId,
      query: input.query,
    },
  };
}

function isAcceptedEvidence(
  record: SourceRecord,
  baseline?: ResolverOperator
): { accepted: boolean; weak: boolean } {
  const hasDirectSurface = Boolean(record.booking || record.instagram || record.website);
  if (hasDirectSurface) return { accepted: true, weak: false };

  const corroboratingIdentity =
    Boolean(record.phone && (record.address || record.city) && record.name) ||
    Boolean(record.source === "directory" && record.phone && baseline?.canonicalCity && record.city === baseline.canonicalCity);
  if (corroboratingIdentity) return { accepted: true, weak: false };

  return { accepted: false, weak: true };
}

function writeSummary(data: unknown): void {
  fs.mkdirSync(path.dirname(SUMMARY_PATH), { recursive: true });
  fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(data, null, 2)}\n`);
}

export async function runDirectoryBackedSurfacePromotion(opts?: { limit?: number; maxQueriesPerOperator?: number }): Promise<void> {
  const limit = Math.max(1, Math.min(120, opts?.limit ?? 60));
  const maxQueriesPerOperator = Math.max(1, Math.min(8, opts?.maxQueriesPerOperator ?? 6));

  const before = loadResolverRegistry();
  const beforeMap = new Map(before.map((x) => [x.id, x]));
  const selection = selectDirectoryBackedPromotionCandidates(before, { limit });

  let queriesGenerated = 0;
  let queriesExecuted = 0;
  let searchHitsSeen = 0;
  let rejectedWeakHits = 0;

  const queryCandidates: SourceRecord[] = [];
  for (const candidate of selection.candidates) {
    const queries = buildDirectoryBackedSurfacePromotionQueries(candidate.operator, { maxQueries: maxQueriesPerOperator });
    queriesGenerated += queries.length;
    for (const query of queries) {
      queriesExecuted += 1;
      const hits = await runGoogleSearch(query, 4, {
        strictQuery: true,
        intent: "directory_backed_surface_promotion",
        operatorId: candidate.operator.id,
        candidateStrength: candidate.score,
      });
      searchHitsSeen += hits.length;
      for (const hit of hits) {
        if (!hit.link || !hit.link.startsWith("http")) continue;
        queryCandidates.push(
          toCandidateRecord({
            operator: candidate.operator,
            url: hit.link,
            query,
            snippet: hit.snippet,
            strength: candidate.score,
          })
        );
      }
    }
  }

  const acquisition = await runAcquisition(queryCandidates, {
    artifactPath: "runtime-data/directory_backed_surface_promotion_acquisition_scan.json",
  });

  const accepted: SourceRecord[] = [];
  for (const row of acquisition.enrichedRecords) {
    const operatorId =
      row.raw && typeof row.raw === "object" && "operatorId" in (row.raw as Record<string, unknown>)
        ? String((row.raw as Record<string, unknown>).operatorId || "")
        : "";
    const baseline = operatorId ? beforeMap.get(operatorId) : undefined;
    const decision = isAcceptedEvidence(row, baseline);
    if (decision.accepted) accepted.push(row);
    if (decision.weak) rejectedWeakHits += 1;
  }

  const evidenceRows = sourceRecordsToEvidence(accepted);
  appendEvidence(evidenceRows);
  const after = runResolver();
  const afterMap = new Map(after.map((x) => [x.id, x]));

  let upgradedWithInstagram = 0;
  let upgradedWithBooking = 0;
  let upgradedWithWebsite = 0;
  let promotedToEnriched = 0;
  let promotedToHot = 0;
  const topPromotions: Array<{
    operatorId: string;
    name?: string;
    beforeStatus: string;
    afterStatus: string;
    evidenceGained: PromotionEvidenceGain;
  }> = [];

  for (const candidate of selection.candidates) {
    const pre = beforeMap.get(candidate.operator.id);
    const post = afterMap.get(candidate.operator.id);
    if (!pre || !post) continue;

    const evidenceGained: PromotionEvidenceGain = {
      instagram: Boolean(!pre.canonicalInstagram && post.canonicalInstagram),
      booking: Boolean(!pre.canonicalBooking && post.canonicalBooking),
      website: Boolean(!pre.canonicalWebsite && post.canonicalWebsite),
    };
    if (evidenceGained.instagram) upgradedWithInstagram += 1;
    if (evidenceGained.booking) upgradedWithBooking += 1;
    if (evidenceGained.website) upgradedWithWebsite += 1;

    if (pre.status !== "hot" && post.status === "hot") promotedToHot += 1;
    if ((pre.status === "enumerated" || pre.status === "shelved") && post.status === "enriched") promotedToEnriched += 1;

    if (
      pre.status !== post.status ||
      evidenceGained.instagram ||
      evidenceGained.booking ||
      evidenceGained.website
    ) {
      topPromotions.push({
        operatorId: candidate.operator.id,
        name: post.canonicalName || pre.canonicalName,
        beforeStatus: pre.status,
        afterStatus: post.status,
        evidenceGained,
      });
    }
  }

  writeSummary({
    generatedAt: new Date().toISOString(),
    candidateCount: selection.candidates.length,
    queriesGenerated,
    queriesExecuted,
    searchHitsSeen,
    acceptedEvidenceCount: evidenceRows.length,
    upgradedWithInstagram,
    upgradedWithBooking,
    upgradedWithWebsite,
    promotedToEnriched,
    promotedToHot,
    rejectedWeakHits,
    skippedAlreadyEnriched: selection.skippedAlreadyEnriched,
    skippedSolaOnly: selection.skippedSolaOnly,
    topPromotions: topPromotions.slice(0, 25),
  });
}

if (require.main === module) {
  runDirectoryBackedSurfacePromotion()
    .then(() => {
      process.stdout.write(`${JSON.stringify({ summaryPath: "runtime-data/directory_backed_surface_promotion_summary.json" }, null, 2)}\n`);
    })
    .catch((error: unknown) => {
      process.stderr.write(`${String(error)}\n`);
      process.exitCode = 1;
    });
}
