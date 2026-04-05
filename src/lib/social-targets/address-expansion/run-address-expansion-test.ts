import { buildAddressExpansionQueryPack, type AddressExpansionAnchor } from "./query-generator";
import { classifyAddressExpansion, normalizeAddressKey } from "./classification";
import { runAddressExpansion, type AddressExpansionQueryResultSet, type AddressExpansionResultItem } from "./run-address-expansion";
import { writeJsonFilePretty } from "../json-file";
import { normalizeSocialTarget } from "../normalization";
import {
  RUNTIME_ADDRESS_EXPANSION_BASELINE_FILE,
  RUNTIME_ADDRESS_EXPANSION_QUALITY_SAMPLE_FILE,
  RUNTIME_ADDRESS_EXPANSION_REPORT_FILE,
} from "../runtime-paths";
import { getMergedSocialTargets, saveMergedSocialTargetsAsRuntime } from "../social-targets-store";
import type { AddressExpansionCandidate, CandidateType, ProspectTier, SocialEvidenceItem, SocialTarget } from "../../../types/social-target";

type Baseline = {
  knownTargets: number;
  withInstagram: number;
  withTikTok: number;
  withLinktree: number;
  withBooking: number;
  existingTargetNames: string[];
  existingCoverage: Array<{
    id: string;
    name: string;
    hasInstagram: boolean;
    hasTikTok: boolean;
    hasLinktree: boolean;
    hasBooking: boolean;
  }>;
};

type Results = {
  totalCandidatesDiscovered: number;
  newUniqueOperators: number;
  candidatesWithInstagram: number;
  candidatesWithTikTok: number;
  candidatesWithLinktree: number;
  candidatesWithBooking: number;
  multiSignalCandidates: number;
};

type CandidateSummary = {
  name: string;
  sourceEvidenceTypes: string[];
  platformsFound: string[];
  confidenceScore: number;
  resolutionStatus: "resolved" | "partial" | "unknown" | "conflict";
  type?: CandidateType;
  tier?: ProspectTier;
  addressMatch?: string;
};

type QualitySampleItem = {
  name: string;
  hasInstagram: boolean;
  hasTikTok: boolean;
  hasLinktree: boolean;
  hasBooking: boolean;
  manualCheck: "live_correct" | "wrong_business" | "dead" | "ambiguous";
};

export type AddressExpansionTestInput = {
  targetId?: string;
  address?: string;
  city?: string;
  state?: string;
  persistResults?: boolean;
};

export type AddressExpansionTestOutput = {
  address: string;
  city: string;
  state: string;
  targetId: string;
  baseline: Baseline;
  results: Results;
  topCandidates: CandidateSummary[];
  qualitySample: QualitySampleItem[];
};

const DEFAULT_TARGET = {
  address: "6001 S Willow Dr, Greenwood Village, CO 80111",
  city: "Greenwood Village",
  state: "CO",
};

function shortId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function normalizeName(value?: string): string {
  const base = (value ?? "").split("|")[0]?.split("•")[0]?.split(" - ")[0] ?? value ?? "";
  return base
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPlatform(target: SocialTarget, platform: "instagram" | "tiktok" | "linktree"): boolean {
  if (target.platforms?.[platform]) return true;
  if ((target.evidence ?? []).some((ev) => ev.platform === platform || ev.type === platform)) return true;
  return (target.socialCandidates ?? []).some((candidate) => candidate.platform === platform);
}

function hasBooking(target: SocialTarget): boolean {
  if ((target.evidence ?? []).some((ev) => ev.type === "booking_platform" || ev.domainType === "booking_platform")) return true;
  return (target.socialCandidates ?? []).some((candidate) => candidate.platform === "booking");
}

function confidenceToScore(confidence: AddressExpansionCandidate["confidence"]): number {
  if (confidence === "high") return 88;
  if (confidence === "medium") return 64;
  return 38;
}

function deriveResolution(score: number, evidenceCount: number): "resolved" | "partial" | "unknown" | "conflict" {
  if (score >= 82 && evidenceCount >= 2) return "resolved";
  if (score >= 56) return "partial";
  return "unknown";
}

function createFixtureByCategory(): Record<string, AddressExpansionResultItem[]> {
  return {
    address_suites: [
      { title: "Sola Salon Studios DTC - Greenwood Village", url: "https://www.solasalonstudios.com/locations/denver-tech-center", snippet: "Independent beauty professionals at 6001 S Willow Dr." },
      { title: "Phenix Salon Suites - DTC Area", url: "https://www.phenixsalonsuites.com/locations/colorado/greenwood-village", snippet: "Salon suites for stylists and estheticians near DTC." },
    ],
    aggregator_brand: [
      { title: "Sola DTC directory of salon professionals", url: "https://www.solasalonstudios.com/locations/denver-tech-center/salon-professionals", snippet: "Hair, lashes, nails and brows studios at this location." },
      { title: "Image Studios Cherry Creek tenant page", url: "https://imagestudios360.com/locations/cherry-creek", snippet: "Studios for independent beauty operators in Denver." },
    ],
    booking_platform: [
      { title: "Ashley Color Studio | Vagaro", url: "https://www.vagaro.com/ashleycolorstudio", snippet: "Book color and balayage appointments." },
      { title: "Brows by Nia - GlossGenius", url: "https://glossgenius.com/biz/browsbynia", snippet: "Brow shaping and lamination in DTC." },
      { title: "Lash Loft at Willow - Booksy", url: "https://booksy.com/en-us/143778_lash-loft-at-willow", snippet: "Lash extension bookings near Greenwood Village." },
      { title: "Mane by Jules | StyleSeat", url: "https://www.styleseat.com/m/v/manebyjules", snippet: "Hair stylist accepting new clients." },
      { title: "Skin Ritual Studio - Fresha", url: "https://www.fresha.com/a/skin-ritual-studio-greenwood-village", snippet: "Facials and peels." },
      { title: "Nails by Cam booking", url: "https://nailsbycam.square.site/", snippet: "Book manicures and gel services." },
    ],
    social_platform: [
      { title: "Ashley Color Studio (@ashleycolorstudio) • Instagram", url: "https://www.instagram.com/ashleycolorstudio/", snippet: "DTC hair color specialist." },
      { title: "Ashley Color Studio on TikTok", url: "https://www.tiktok.com/@ashleycolorstudio", snippet: "Color transformation videos." },
      { title: "Brows by Nia (@browsbynia.dtc) • Instagram", url: "https://www.instagram.com/browsbynia.dtc/", snippet: "Brow artist in Greenwood Village." },
      { title: "Lash Loft at Willow (@lashloftwillow) • Instagram", url: "https://www.instagram.com/lashloftwillow/", snippet: "Classic and volume lashes." },
      { title: "Skin Ritual Studio on TikTok", url: "https://www.tiktok.com/@skinritualstudio", snippet: "Skincare tips from DTC esthetician." },
      { title: "Mane by Jules Linktree", url: "https://linktr.ee/manebyjules", snippet: "Booking + Instagram + TikTok." },
      { title: "Nails by Cam (@nailsbycamgv) • Instagram", url: "https://www.instagram.com/nailsbycamgv/", snippet: "Builder gel and art sets." },
      { title: "Glow by Dani Linktree", url: "https://linktr.ee/glowbydani", snippet: "Facials, waxing and booking links." },
    ],
    directory_expansion: [
      { title: "Yelp - Ashley Color Studio", url: "https://www.yelp.com/biz/ashley-color-studio-greenwood-village", snippet: "Hair salons near 6001 S Willow Dr." },
      { title: "Yelp - Brows by Nia", url: "https://www.yelp.com/biz/brows-by-nia-greenwood-village", snippet: "Brows and waxing in DTC suites." },
      { title: "Yelp - Beauty Academy DTC", url: "https://www.yelp.com/biz/beauty-academy-dtc-denver", snippet: "Training center near business district." },
    ],
    address_businesses: [
      { title: "Businesses at 6001 S Willow Dr", url: "https://www.mapquest.com/us/colorado/6001-s-willow-dr-greenwood-village-co-80111", snippet: "Sola suites with multiple independent operators." },
      { title: "Operator list - Willow beauty suites", url: "https://www.solasalonstudios.com/locations/denver-tech-center/salon-professionals", snippet: "Stylists, estheticians, nails and brow artists." },
      { title: "Old profile not found", url: "https://www.instagram.com/closedstylist404/", snippet: "Sorry, this page isn't available." },
    ],
    address_stylist: [
      { title: "KJ Hair Craft at Willow Studios", url: "https://www.instagram.com/kjhaircraft/", snippet: "Haircut and lived-in color specialist." },
      { title: "KJ Hair Craft booking", url: "https://www.vagaro.com/kjhaircraft", snippet: "Schedule appointments online." },
      { title: "Brows by Nia Linktree", url: "https://linktr.ee/browsbynia", snippet: "Book now and social channels." },
    ],
    address_salons: [
      { title: "Lash Loft at Willow | Linktree", url: "https://linktr.ee/lashloftwillow", snippet: "Lash booking and socials." },
      { title: "Nails by Cam on TikTok", url: "https://www.tiktok.com/@nailsbycamgv", snippet: "Nail design videos and trends." },
      { title: "Glow by Dani booking page", url: "https://glossgenius.com/biz/glowbydani", snippet: "Book facials and glow treatments." },
    ],
    category_geo_expansion: [
      { title: "Massage by Eli DTC", url: "https://www.instagram.com/massagebyeli_dtc/", snippet: "Sports massage and recovery sessions." },
      { title: "Massage by Eli booking", url: "https://booksy.com/en-us/94822_massage-by-eli", snippet: "Reserve appointments in Greenwood Village." },
      { title: "Thread by Noor DTC", url: "https://www.instagram.com/threadbynoordtc/", snippet: "Brow threading and henna services." },
    ],
  };
}

function buildFixtureResults(queryPack: ReturnType<typeof buildAddressExpansionQueryPack>): AddressExpansionQueryResultSet[] {
  const fixtures = createFixtureByCategory();
  const used = new Set<string>();
  const out: AddressExpansionQueryResultSet[] = queryPack.queries.map((query) => {
    const results = fixtures[query.category] ?? [];
    if (!results.length) return { query, results: [] };
    if (used.has(query.category)) return { query, results: [] };
    used.add(query.category);
    return { query, results };
  });
  for (const [category, results] of Object.entries(fixtures)) {
    if (used.has(category)) continue;
    out.push({
      query: {
        query: `"${DEFAULT_TARGET.address}" "${category.replace(/_/g, " ")}"`,
        category: category as AddressExpansionQueryResultSet["query"]["category"],
        confidenceHint: "expansion",
        notes: "Supplemental layer coverage for address expansion test",
      },
      results,
    });
    used.add(category);
  }
  return out;
}

function computeBaseline(rows: SocialTarget[]): Baseline {
  return {
    knownTargets: rows.length,
    withInstagram: rows.filter((row) => hasPlatform(row, "instagram")).length,
    withTikTok: rows.filter((row) => hasPlatform(row, "tiktok")).length,
    withLinktree: rows.filter((row) => hasPlatform(row, "linktree")).length,
    withBooking: rows.filter(hasBooking).length,
    existingTargetNames: rows.map((row) => row.businessName || row.handle),
    existingCoverage: rows.map((row) => ({
      id: row.id,
      name: row.businessName || row.handle,
      hasInstagram: hasPlatform(row, "instagram"),
      hasTikTok: hasPlatform(row, "tiktok"),
      hasLinktree: hasPlatform(row, "linktree"),
      hasBooking: hasBooking(row),
    })),
  };
}

function signalSet(candidate: AddressExpansionCandidate, evidenceById: Map<string, SocialEvidenceItem>): Set<string> {
  const out = new Set<string>();
  if (candidate.platform) out.add(candidate.platform);
  if (candidate.bookingUrl) out.add("booking");
  for (const id of candidate.evidenceIds) {
    const ev = evidenceById.get(id);
    if (!ev) continue;
    if (ev.type === "instagram") out.add("instagram");
    if (ev.type === "tiktok") out.add("tiktok");
    if (ev.type === "linktree") out.add("linktree");
    if (ev.type === "booking_platform" || ev.domainType === "booking_platform") out.add("booking");
    if (ev.type === "directory_expansion" || ev.type === "directory") out.add("directory");
    if (ev.type === "aggregator_site" || ev.type === "suite_operator") out.add("aggregator");
  }
  return out;
}

function manualCheck(summary: CandidateSummary): QualitySampleItem["manualCheck"] {
  const name = summary.name.toLowerCase();
  if (name.includes("404") || name.includes("not found") || name.includes("closed")) return "dead";
  if (name.includes("academy") || name.includes("training")) return "wrong_business";
  if (summary.confidenceScore >= 64 && (summary.platformsFound.includes("instagram") || summary.platformsFound.includes("tiktok")) && summary.platformsFound.includes("booking")) {
    return "live_correct";
  }
  return "ambiguous";
}

function addressMatchLabel(candidate: AddressExpansionCandidate): string {
  const match = candidate.prospect?.addressMatch;
  if (!match) return "none";
  if (match.exactAddressMatch && match.propertyMatch) return "exact+property";
  if (match.exactAddressMatch) return "exact";
  if (match.propertyMatch && match.cityMatch) return "property+city";
  if (match.propertyMatch) return "property";
  if (match.cityMatch) return "city";
  return "none";
}

function buildAnchor(target: SocialTarget, address: string, city: string): AddressExpansionAnchor {
  const aliases = [target.businessName, target.handle.replace(/^@/, "")]
    .filter((v): v is string => Boolean(v && v.trim()))
    .filter((v, i, arr) => arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i)
    .slice(1, 3);
  return {
    businessName: target.businessName || target.handle.replace(/^@/, ""),
    nameVariants: aliases.length ? aliases : undefined,
    category: target.category,
    city,
    zone: target.zone,
    address,
    normalizedAddress: normalizeAddressKey(address),
  };
}

export async function runAddressExpansionTest(input: AddressExpansionTestInput = {}): Promise<AddressExpansionTestOutput> {
  const address = input.address ?? DEFAULT_TARGET.address;
  const city = input.city ?? DEFAULT_TARGET.city;
  const state = input.state ?? DEFAULT_TARGET.state;
  const normalizedAddress = normalizeAddressKey(address);
  const sourceVersion = "address-expansion-v1-test";
  const runId = `address-expansion-test-${new Date().toISOString().slice(0, 10)}-${shortId()}`;

  const allTargets = (await getMergedSocialTargets()).map(normalizeSocialTarget);
  const baseTarget =
    allTargets.find((target) => target.id === input.targetId) ??
    allTargets.find((target) => target.id === "hairbymarissadtc") ??
    allTargets.find((target) => target.zone.toLowerCase().includes("dtc")) ??
    allTargets[0];
  if (!baseTarget) throw new Error("No social targets available to run address expansion test");

  const addressLinked = allTargets.filter((target) => {
    const key = normalizeAddressKey(target.normalizedAddress ?? target.addressExpansion?.normalizedAddress ?? target.addressExpansion?.sourceAddress);
    return Boolean(key && key === normalizedAddress);
  });
  const baselineRows = addressLinked.length
    ? addressLinked
    : [baseTarget];
  const baseline = computeBaseline(baselineRows);
  await writeJsonFilePretty(RUNTIME_ADDRESS_EXPANSION_BASELINE_FILE, {
    generatedAt: new Date().toISOString(),
    runId,
    address,
    city,
    state,
    normalizedAddress,
    baseline,
  });

  const classification = classifyAddressExpansion({
    target: baseTarget,
    allTargets,
    sourceAddress: address,
    normalizedAddress,
  });
  const queryPack = buildAddressExpansionQueryPack(buildAnchor(baseTarget, address, city), classification);
  const queryResults = buildFixtureResults(queryPack);
  const expanded = runAddressExpansion({
    target: baseTarget,
    allTargets,
    sourceAddress: address,
    normalizedAddress,
    runId,
    runType: "expansion_test",
    sourceVersion,
    queryResults,
  });

  if (input.persistResults === true) {
    const nextTargets = allTargets.map((target) => (target.id === expanded.target.id ? expanded.target : target));
    await saveMergedSocialTargetsAsRuntime(nextTargets);
  }

  const candidates = expanded.allCandidates;
  const evidenceById = new Map((expanded.target.evidence ?? []).map((ev) => [ev.id, ev]));
  const baselineOperatorNames = new Set(baselineRows.map((row) => normalizeName(row.businessName || row.handle)));
  const uniqueOperators = new Set(candidates.map((candidate) => normalizeName(candidate.operatorName)).filter(Boolean));
  const newOperators = [...uniqueOperators].filter((name) => !baselineOperatorNames.has(name));

  const byOperator = new Map<
    string,
    { name: string; score: number; readinessScore: number; signals: Set<string>; evidenceTypes: Set<string>; candidateCount: number }
  >();
  const candidateByName = new Map<string, AddressExpansionCandidate>();
  for (const candidate of candidates) {
    const key = normalizeName(candidate.operatorName);
    if (!key) continue;
    if (!candidateByName.has(key)) candidateByName.set(key, candidate);
    const signals = signalSet(candidate, evidenceById);
    const evidenceTypes = new Set<string>();
    for (const evidenceId of candidate.evidenceIds) {
      const ev = evidenceById.get(evidenceId);
      if (ev) evidenceTypes.add(ev.type);
    }
    const score = confidenceToScore(candidate.confidence);
    const readinessScore = candidate.prospect?.readinessScore ?? score;
    const prev = byOperator.get(key);
    if (!prev) {
      byOperator.set(key, { name: candidate.operatorName, score, readinessScore, signals, evidenceTypes, candidateCount: 1 });
      continue;
    }
    byOperator.set(key, {
      name: prev.name,
      score: Math.max(prev.score, score),
      readinessScore: Math.max(prev.readinessScore, readinessScore),
      signals: new Set([...prev.signals, ...signals]),
      evidenceTypes: new Set([...prev.evidenceTypes, ...evidenceTypes]),
      candidateCount: prev.candidateCount + 1,
    });
  }

  const summaries: CandidateSummary[] = [...byOperator.values()]
    .map((row) => {
      const key = normalizeName(row.name);
      const sample = candidateByName.get(key);
      return {
        name: row.name,
        sourceEvidenceTypes: [...row.evidenceTypes].sort(),
        platformsFound: [...row.signals].sort(),
        confidenceScore: row.readinessScore,
        resolutionStatus: deriveResolution(row.readinessScore, row.candidateCount),
        type: sample?.prospect?.type,
        tier: sample?.prospect?.tier,
        addressMatch: sample ? addressMatchLabel(sample) : "none",
      };
    })
    .sort((a, b) => b.confidenceScore - a.confidenceScore);

  const results: Results = {
    totalCandidatesDiscovered: candidates.length,
    newUniqueOperators: newOperators.length,
    candidatesWithInstagram: candidates.filter((candidate) => candidate.platform === "instagram").length,
    candidatesWithTikTok: candidates.filter((candidate) => candidate.platform === "tiktok").length,
    candidatesWithLinktree: candidates.filter((candidate) => candidate.platform === "linktree").length,
    candidatesWithBooking: candidates.filter((candidate) => Boolean(candidate.bookingUrl)).length,
    multiSignalCandidates: summaries.filter((summary) => summary.platformsFound.length >= 3).length,
  };

  const qualitySample: QualitySampleItem[] = summaries.slice(0, 10).map((summary) => ({
    name: summary.name,
    hasInstagram: summary.platformsFound.includes("instagram"),
    hasTikTok: summary.platformsFound.includes("tiktok"),
    hasLinktree: summary.platformsFound.includes("linktree"),
    hasBooking: summary.platformsFound.includes("booking"),
    manualCheck: manualCheck(summary),
  }));
  await writeJsonFilePretty(RUNTIME_ADDRESS_EXPANSION_QUALITY_SAMPLE_FILE, {
    generatedAt: new Date().toISOString(),
    runId,
    address,
    city,
    state,
    sampleSize: qualitySample.length,
    qualitySample,
    note: "Manual check values are auto-seeded heuristics and should be reviewed in operator QA.",
  });

  const prospectBuckets = {
    hot: candidates.filter((candidate) => candidate.prospect?.tier === "hot").length,
    warm: candidates.filter((candidate) => candidate.prospect?.tier === "warm").length,
    cold: candidates.filter((candidate) => candidate.prospect?.tier === "cold").length,
    excluded: candidates.filter((candidate) => candidate.prospect?.tier === "exclude" || !candidate.prospect).length,
  };

  const topHotProspects = summaries
    .filter((summary) => summary.tier === "hot")
    .slice(0, 20)
    .map((summary) => ({
      name: summary.name,
      score: summary.confidenceScore,
      type: summary.type ?? "ambiguous",
      platforms: summary.platformsFound,
      addressMatch: summary.addressMatch ?? "none",
    }));

  const report = {
    address,
    baseline,
    results,
    lift: {
      newOperators: results.newUniqueOperators,
      instagramLift: results.candidatesWithInstagram - baseline.withInstagram,
      bookingLift: results.candidatesWithBooking - baseline.withBooking,
    },
    prospects: prospectBuckets,
    topHotProspects,
    qualitySample,
    summary: {
      coverageImproved: results.newUniqueOperators > 0,
      signalQuality:
        qualitySample.filter((item) => item.manualCheck === "live_correct").length >= 6
          ? "high"
          : qualitySample.filter((item) => item.manualCheck === "wrong_business").length <= 3
            ? "mixed"
            : "low",
      notes:
        "Address expansion test used deterministic multi-layer fixtures across suite, booking, social, and directory signals to validate lift without crawler automation.",
    },
    topCandidates: summaries.slice(0, 20),
    queryLayersExecuted: [...new Set(queryPack.queries.map((query) => query.category))],
    targetId: baseTarget.id,
    runId,
    runType: "expansion_test",
    sourceVersion,
    generatedAt: new Date().toISOString(),
  };
  await writeJsonFilePretty(RUNTIME_ADDRESS_EXPANSION_REPORT_FILE, report);

  const liveCorrect = qualitySample.filter((item) => item.manualCheck === "live_correct").length;
  const wrong = qualitySample.filter((item) => item.manualCheck === "wrong_business").length;
  const dead = qualitySample.filter((item) => item.manualCheck === "dead").length;
  const ambiguous = qualitySample.filter((item) => item.manualCheck === "ambiguous").length;
  console.log("ADDRESS EXPANSION TEST");
  console.log(`Baseline operators: ${baseline.knownTargets}`);
  console.log(`New operators discovered: ${results.newUniqueOperators}`);
  console.log(`Total operators: ${baseline.knownTargets + results.newUniqueOperators}`);
  console.log(`Instagram found: ${baseline.withInstagram} -> ${results.candidatesWithInstagram}`);
  console.log(`Booking pages found: ${baseline.withBooking} -> ${results.candidatesWithBooking}`);
  console.log(`Multi-signal operators: ${results.multiSignalCandidates}`);
  console.log(`Prospects hot/warm/cold/excluded: ${prospectBuckets.hot}/${prospectBuckets.warm}/${prospectBuckets.cold}/${prospectBuckets.excluded}`);
  console.log("Quality sample:");
  console.log(`- live correct: ${liveCorrect}`);
  console.log(`- wrong: ${wrong}`);
  console.log(`- dead: ${dead}`);
  console.log(`- ambiguous: ${ambiguous}`);

  return {
    address,
    city,
    state,
    targetId: baseTarget.id,
    baseline,
    results,
    topCandidates: summaries.slice(0, 20),
    qualitySample,
  };
}
