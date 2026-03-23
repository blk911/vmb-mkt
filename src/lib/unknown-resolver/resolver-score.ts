import { isActiveResolverCategory } from "./resolver-categories";
import { canUseHouseCleaningScoring, canUseNailsScoring } from "./resolver-category-guards";
import { scoreNailsRecord } from "./resolver-nails-score";
import type {
  ResolverCandidate,
  ResolverRecommendation,
  ResolverScoreBreakdown,
  UnknownResolverRecord,
} from "./resolver-types";
import { compactAddress, normalizeBusinessName } from "./resolver-normalize";

const POSITIVE_RESIDENTIAL = [
  "house cleaning",
  "home cleaning",
  "maid service",
  "housekeeping",
  "residential cleaning",
  "deep cleaning",
  "move out cleaning",
  "move-out cleaning",
  "apartment cleaning",
  "recurring",
  "home clean",
];

const NEGATIVE_VERTICAL = [
  { keys: ["carpet cleaning", "carpet steam", "upholstery only"], label: "carpet/upholstery focus" },
  { keys: ["pressure washing", "power washing"], label: "pressure washing" },
  { keys: ["commercial janitorial", "office buildings", "janitorial for office"], label: "commercial janitorial" },
  { keys: ["industrial cleaning"], label: "industrial cleaning" },
  { keys: ["cleaning supply", "supply store"], label: "retail/supplies" },
  { keys: ["restoration", "remediation", "mold remediation"], label: "restoration/remediation" },
  { keys: ["pool cleaning"], label: "pool cleaning" },
  { keys: ["duct cleaning", "air duct"], label: "duct cleaning" },
  { keys: ["laundromat", "coin laundry"], label: "laundromat" },
  { keys: ["car wash", "auto detailing"], label: "car wash" },
];

const GENERIC_CLEANING = ["cleaning services", "cleaning service", "professional cleaning"];

function allText(record: UnknownResolverRecord, candidates: ResolverCandidate[]): string {
  const chunks = [
    record.sourceName,
    record.normalizedName,
    record.address,
    record.city,
    ...candidates.flatMap((c) => [c.title, c.snippet, c.matchedName, c.matchedAddress, c.matchedPhone]),
  ];
  return chunks.filter(Boolean).join(" \n ").toLowerCase();
}

function hasAny(hay: string, needles: string[]): boolean {
  return needles.some((n) => hay.includes(n));
}

function nameMatchScore(record: UnknownResolverRecord, candidates: ResolverCandidate[]): number {
  const rn = normalizeBusinessName(record.sourceName ?? record.normalizedName);
  if (!rn || rn.length < 2) return 5;

  let best = 5;
  for (const c of candidates) {
    const mn = normalizeBusinessName(c.matchedName);
    const tn = normalizeBusinessName(c.title);
    if (mn && (mn === rn || rn === mn)) best = Math.max(best, 30);
    else if (mn && (mn.includes(rn) || rn.includes(mn))) best = Math.max(best, 15);
    else if (tn && (tn.includes(rn) || rn.includes(tn))) best = Math.max(best, 15);
    else if (mn || tn) best = Math.max(best, 5);
  }
  return Math.min(30, best);
}

function categoryScoreBlock(text: string): { score: number; note: string } {
  for (const neg of NEGATIVE_VERTICAL) {
    if (hasAny(text, neg.keys)) {
      return { score: -20, note: `Unrelated vertical: ${neg.label}.` };
    }
  }

  if (hasAny(text, POSITIVE_RESIDENTIAL)) {
    return { score: 25, note: "Explicit residential house/home cleaning signals." };
  }
  if (hasAny(text, GENERIC_CLEANING)) {
    return { score: 12, note: "Generic cleaning services wording only." };
  }
  if (text.includes("clean")) {
    return { score: 6, note: "Ambiguous cleaning-related wording." };
  }
  return { score: 0, note: "Weak category signals." };
}

function geoScore(record: UnknownResolverRecord, candidates: ResolverCandidate[]): number {
  const city = record.city?.trim().toLowerCase() ?? "";
  const zip = record.zip?.trim() ?? "";
  const addr = compactAddress(record.address).toLowerCase();

  let best = 0;
  for (const c of candidates) {
    const ma = (c.matchedAddress ?? "").toLowerCase();
    if (addr && ma && (ma.includes(addr.slice(0, Math.min(12, addr.length))) || addr.includes(ma.slice(0, 12)))) {
      best = Math.max(best, 20);
    } else if (city && ma.includes(city)) {
      best = Math.max(best, 12);
    }
  }
  if (city && candidates.some((c) => (c.matchedAddress ?? "").toLowerCase().includes(city))) {
    best = Math.max(best, 8);
  }
  if (zip && candidates.some((c) => (c.matchedAddress ?? "").includes(zip))) {
    best = Math.max(best, 12);
  }
  return Math.min(20, best);
}

function webPresenceScore(candidates: ResolverCandidate[]): number {
  let s = 0;
  const sources = new Set(candidates.map((c) => c.source));
  if (sources.has("website") || candidates.some((c) => (c.url ?? "").includes("http"))) {
    s += 10;
  }
  if (sources.has("facebook") || sources.has("yelp")) s += 5;
  if (sources.has("thumbtack") || sources.has("angi")) s += 5;
  return Math.min(20, s);
}

function platformSignalsScore(candidates: ResolverCandidate[]): number {
  const uniqueSources = new Set(candidates.map((c) => c.source)).size;
  let s = 0;
  if (uniqueSources >= 2) s += 10;
  const blob = candidates
    .map((c) => `${c.snippet ?? ""} ${c.title ?? ""}`)
    .join(" ")
    .toLowerCase();
  if (blob.includes("book") || blob.includes("schedule") || blob.includes("recurring")) s += 10;
  const phones = candidates.map((c) => c.matchedPhone?.replace(/\D/g, "") ?? "").filter(Boolean);
  if (phones.length >= 2 && new Set(phones).size === 1) s += 10;
  else if (phones.length >= 1) s += 5;
  return Math.min(30, s);
}

function penaltyBlock(text: string, candidates: ResolverCandidate[]): { penalty: number; reason: string } {
  let p = 0;
  const reasons: string[] = [];

  if (hasAny(text, ["commercial janitorial", "office buildings only", "commercial only"])) {
    p += 20;
    reasons.push("commercial janitorial");
  }
  if (hasAny(text, ["cleaning supply", "retail store"])) {
    p += 25;
    reasons.push("product/retail");
  }
  if (hasAny(text, ["restoration company", "remediation"])) {
    p += 25;
    reasons.push("restoration");
  }
  if (hasAny(text, ["not a business", "personal profile only"])) {
    p += 20;
    reasons.push("noise");
  }

  const cities = new Set(
    candidates.map((c) => {
      const m = c.matchedAddress ?? "";
      const parts = m.split(",");
      return parts.length > 1 ? parts[1]?.trim().toLowerCase() : "";
    })
  );
  if (cities.size > 2 && candidates.length > 2) {
    p += 10;
    reasons.push("conflicting geo");
  }

  return { penalty: Math.min(60, p), reason: reasons.length ? reasons.join("; ") : "" };
}

function recommendFromScore(score: number): ResolverRecommendation {
  if (score >= 70) return "yes";
  if (score >= 40) return "review";
  return "no";
}

function buildReasoning(
  finalScore: number,
  rec: ResolverRecommendation,
  catNote: string,
  penaltyReason: string
): string {
  if (rec === "yes") {
    return `Strong residential cleaning evidence with corroborating signals. ${catNote}`;
  }
  if (rec === "review") {
    return `Cleaning-related but insufficient residential proof or mixed signals. ${catNote}${
      penaltyReason ? ` Penalties: ${penaltyReason}.` : ""
    }`;
  }
  return `Evidence points to unrelated cleaning vertical or weak match. ${catNote}${
    penaltyReason ? ` ${penaltyReason}` : ""
  }`;
}

/**
 * Category-aware entry point. Parked categories (e.g. house_cleaning) stay in repo but are inactive — no score path.
 * Active category (nails) uses nails scorer.
 */
export function scoreResolverRecord(
  record: UnknownResolverRecord,
  candidates: ResolverCandidate[]
): ResolverScoreBreakdown {
  if (!isActiveResolverCategory(record.category)) {
    return {
      recordId: record.id,
      nameScore: 0,
      categoryScore: 0,
      geoScore: 0,
      webPresenceScore: 0,
      platformScore: 0,
      conflictPenalty: 0,
      finalScore: 0,
      recommendation: "no",
      reasoning: "Inactive or unsupported resolver category for this pipeline.",
    };
  }
  if (canUseHouseCleaningScoring(record)) {
    return scoreHouseCleaningRecord(record, candidates);
  }
  if (canUseNailsScoring(record)) {
    return scoreNailsRecord(record, candidates);
  }
  return {
    recordId: record.id,
    nameScore: 0,
    categoryScore: 0,
    geoScore: 0,
    webPresenceScore: 0,
    platformScore: 0,
    conflictPenalty: 0,
    finalScore: 0,
    recommendation: "no",
    reasoning: "Unsupported category for current resolver.",
  };
}

/**
 * Deterministic 0–100 score for house cleaning from record + candidate evidence.
 * Parked reference — unused at runtime while `house_cleaning` ∉ ACTIVE_RESOLVER_CATEGORIES.
 */
export function scoreHouseCleaningRecord(
  record: UnknownResolverRecord,
  candidates: ResolverCandidate[]
): ResolverScoreBreakdown {
  const text = allText(record, candidates);

  const ns = nameMatchScore(record, candidates);
  const cat = categoryScoreBlock(text);
  const gs = geoScore(record, candidates);
  const ws = webPresenceScore(candidates);
  const ps = platformSignalsScore(candidates);
  const pen = penaltyBlock(text, candidates);

  const raw = ns + cat.score + gs + ws + ps;
  const conflictPenalty = pen.penalty;
  const finalScore = Math.max(0, Math.min(100, raw - conflictPenalty));
  const recommendation = recommendFromScore(finalScore);

  const reasoning = buildReasoning(finalScore, recommendation, cat.note, pen.reason);

  return {
    recordId: record.id,
    nameScore: ns,
    categoryScore: cat.score,
    geoScore: gs,
    webPresenceScore: ws,
    platformScore: ps,
    conflictPenalty,
    finalScore,
    recommendation,
    reasoning,
  };
}

/** Overlay persisted snapshot onto computed breakdown for stable UI / downstream. */
export function mergeStoredScoreBreakdown(
  record: UnknownResolverRecord,
  computed: ResolverScoreBreakdown
): ResolverScoreBreakdown {
  return {
    ...computed,
    finalScore: record.systemScore ?? computed.finalScore,
    recommendation: record.systemRecommendation ?? computed.recommendation,
    reasoning: record.scoreReasoning ?? computed.reasoning,
  };
}
