import type {
  ResolverCandidate,
  ResolverRecommendation,
  ResolverScoreBreakdown,
  UnknownResolverRecord,
} from "./resolver-types";
import { compactAddress, normalizeBusinessName } from "./resolver-normalize";

function allText(record: UnknownResolverRecord, candidates: ResolverCandidate[]): string {
  const chunks = [
    record.sourceName,
    record.normalizedName,
    record.address,
    record.city,
    ...candidates.flatMap((c) => [c.title, c.snippet, c.matchedName, c.matchedAddress, c.matchedPhone, c.url]),
  ];
  return chunks.filter(Boolean).join(" \n ").toLowerCase();
}

function hasAny(hay: string, needles: string[]): boolean {
  return needles.some((n) => hay.includes(n));
}

/** 0–25 */
function nameMatchScore(record: UnknownResolverRecord, candidates: ResolverCandidate[]): number {
  const rn = normalizeBusinessName(record.sourceName ?? record.normalizedName);
  if (!rn || rn.length < 2) return 5;

  let best = 5;
  for (const c of candidates) {
    const mn = normalizeBusinessName(c.matchedName);
    const tn = normalizeBusinessName(c.title);
    if (mn && (mn === rn || rn === mn)) best = Math.max(best, 25);
    else if (mn && (mn.includes(rn) || rn.includes(mn))) best = Math.max(best, 12);
    else if (tn && (tn.includes(rn) || rn.includes(tn))) best = Math.max(best, 12);
    else if (mn || tn) best = Math.max(best, 5);
  }
  return Math.min(25, best);
}

/** Service / vertical fit → maps to categoryScore field (0–25). */
function nailServiceScore(text: string): { score: number; note: string } {
  if (
    hasAny(text, [
      "hair salon",
      "hair only",
      "haircuts",
      "barber",
      "barbershop",
      "mens cut",
    ]) &&
    !hasAny(text, ["nail", "manicure", "pedicure", "gel"])
  ) {
    return { score: 0, note: "Hair-focused business without nail evidence." };
  }
  if (hasAny(text, ["waxing only", "wax studio only"]) && !hasAny(text, ["nail", "manicure"])) {
    return { score: 2, note: "Waxing-only signals." };
  }
  if (hasAny(text, ["beauty supply", "cosmetics store", "retail supply"])) {
    return { score: 0, note: "Retail/supply rather than service." };
  }

  if (hasAny(text, ["nail salon", "nail studio", "nails &", "nails and"])) {
    return { score: 25, note: "Explicit nail salon / studio positioning." };
  }
  if (hasAny(text, ["manicure", "pedicure", "mani pedi", "manicurist"])) {
    return { score: 20, note: "Manicure / pedicure service language." };
  }
  if (hasAny(text, ["acrylic", "dip powder", "gel-x", "builder gel", "nail art", "gel nails"])) {
    return { score: 18, note: "Nail specialty services (acrylic/gel/art)." };
  }
  if (hasAny(text, ["nail tech", "nail artist", "nail designer"])) {
    return { score: 14, note: "Nail tech / artist language." };
  }
  if (hasAny(text, ["beauty lounge", "salon", "spa"]) && hasAny(text, ["nail", "mani"])) {
    return { score: 10, note: "Mixed beauty with some nail mention." };
  }
  if (hasAny(text, ["salon", "beauty", "spa"])) {
    return { score: 6, note: "Generic beauty/salon wording; nail fit unclear." };
  }
  return { score: 0, note: "Weak nail-specific signals." };
}

function negativePenalty(text: string): { penalty: number; tags: string[] } {
  let p = 0;
  const tags: string[] = [];

  if (
    hasAny(text, ["hair salon", "hair only", "barber shop", "barbershop"]) &&
    !hasAny(text, ["nail", "mani", "pedi"])
  ) {
    p += 25;
    tags.push("hair-only");
  }
  if (hasAny(text, ["barber"]) && !hasAny(text, ["nail"])) {
    p += 25;
    tags.push("barber");
  }
  if (hasAny(text, ["waxing only", "wax studio"]) && !hasAny(text, ["nail", "mani"])) {
    p += 20;
    tags.push("waxing-only");
  }
  if (hasAny(text, ["esthetician only", "facials only"]) && !hasAny(text, ["nail", "mani"])) {
    p += 15;
    tags.push("esthetician-only");
  }
  if (hasAny(text, ["day spa", "med spa", "spa"]) && !hasAny(text, ["nail", "mani", "pedi", "nail salon"])) {
    p += 15;
    tags.push("spa-no-nails");
  }
  if (hasAny(text, ["beauty supply", "cosmetics retail", "supply store"])) {
    p += 25;
    tags.push("retail/supply");
  }
  if (hasAny(text, ["house cleaning", "janitorial"])) {
    p += 30;
    tags.push("unrelated-service");
  }

  return { penalty: Math.min(80, p), tags };
}

function geoScoreNails(record: UnknownResolverRecord, candidates: ResolverCandidate[]): number {
  const city = record.city?.trim().toLowerCase() ?? "";
  const zip = record.zip?.trim() ?? "";
  const addr = compactAddress(record.address).toLowerCase();

  let best = 0;
  for (const c of candidates) {
    const ma = (c.matchedAddress ?? "").toLowerCase();
    if (addr && ma && (ma.includes(addr.slice(0, Math.min(12, addr.length))) || addr.includes(ma.slice(0, 12)))) {
      best = Math.max(best, 15);
    } else if (city && ma.includes(city)) {
      best = Math.max(best, 10);
    }
  }
  if (city && candidates.some((c) => (c.matchedAddress ?? "").toLowerCase().includes(city))) {
    best = Math.max(best, 8);
  }
  if (zip && candidates.some((c) => (c.matchedAddress ?? "").includes(zip))) {
    best = Math.max(best, 10);
  }
  if (best > 0 && best < 8) best = 6;
  return Math.min(15, best);
}

function webAndBookingScore(candidates: ResolverCandidate[], text: string): number {
  let s = 0;
  const urls = candidates.map((c) => (c.url ?? "").toLowerCase()).join(" ");
  const sources = new Set(candidates.map((c) => c.source));

  if (sources.has("website") || candidates.some((c) => (c.url ?? "").startsWith("http"))) {
    s += 10;
  }
  if (
    hasAny(urls, ["booksy.com", "vagaro.com", "glossgenius.com", "square.site", "squareup.com"]) ||
    hasAny(text, ["book now", "booksy", "vagaro", "glossgenius"])
  ) {
    s += 12;
  }
  if (sources.has("facebook") || hasAny(text, ["facebook.com", "instagram"])) s += 6;
  if (sources.has("yelp") || sources.has("google")) s += 4;

  const unique = new Set(candidates.map((c) => c.source)).size;
  if (unique >= 3) s += 10;
  else if (unique >= 2) s += 5;

  return Math.min(28, s);
}

function menuAndPlatformScore(text: string, candidates: ResolverCandidate[]): number {
  let s = 0;
  if (hasAny(text, ["services", "menu", "manicure", "pedicure", "gel", "acrylic"])) {
    s += 10;
  }
  if (hasAny(text, ["nail tech", "nail artist", "licensed nail"])) {
    s += 10;
  }
  const blob = candidates.map((c) => `${c.snippet ?? ""}`).join(" ");
  if (hasAny(blob.toLowerCase(), ["book", "schedule", "appointment"])) s += 5;
  const phones = candidates.map((c) => c.matchedPhone?.replace(/\D/g, "") ?? "").filter(Boolean);
  if (phones.length >= 2 && new Set(phones).size === 1) s += 5;
  else if (phones.length >= 1) s += 3;
  return Math.min(30, s);
}

function recommendFromScore(score: number): ResolverRecommendation {
  if (score >= 70) return "yes";
  if (score >= 40) return "review";
  return "no";
}

function buildReasoning(
  rec: ResolverRecommendation,
  svcNote: string,
  negTags: string[]
): string {
  if (rec === "yes") {
    return `Strong nail-specific service evidence with booking and geo corroboration. ${svcNote}`;
  }
  if (rec === "review") {
    return `Beauty business present, but nails evidence is limited. ${svcNote}${
      negTags.length ? ` Flags: ${negTags.join(", ")}.` : ""
    }`;
  }
  return `Evidence points to non-nail beauty or unrelated business. ${svcNote}${
    negTags.length ? ` ${negTags.join(", ")}.` : ""
  }`;
}

export function scoreNailsRecord(record: UnknownResolverRecord, candidates: ResolverCandidate[]): ResolverScoreBreakdown {
  const text = allText(record, candidates);

  const ns = nameMatchScore(record, candidates);
  const svc = nailServiceScore(text);
  const gs = geoScoreNails(record, candidates);
  const web = webAndBookingScore(candidates, text);
  const plat = menuAndPlatformScore(text, candidates);
  const neg = negativePenalty(text);

  let conflict = neg.penalty;
  const cities = new Set(
    candidates.map((c) => {
      const m = c.matchedAddress ?? "";
      const parts = m.split(",");
      return parts.length > 1 ? parts[1]?.trim().toLowerCase() : "";
    })
  );
  if (cities.size > 2 && candidates.length > 2) {
    conflict += 10;
  }

  const raw = ns + svc.score + gs + web + plat;
  const conflictPenalty = Math.min(80, conflict);
  const finalScore = Math.max(0, Math.min(100, raw - conflictPenalty));
  const recommendation = recommendFromScore(finalScore);
  const reasoning = buildReasoning(recommendation, svc.note, neg.tags);

  return {
    recordId: record.id,
    nameScore: ns,
    categoryScore: svc.score,
    geoScore: gs,
    webPresenceScore: web,
    platformScore: plat,
    conflictPenalty,
    finalScore,
    recommendation,
    reasoning,
  };
}
