import { writeSurfaceRecoveryQueueArtifact } from "@/lib/resolver/registry-store";
import type { OperatorConsoleRow } from "./loadOperators";

export type SurfaceRecoveryCandidate = {
  id: string;
  name: string;
  city?: string;
  status: OperatorConsoleRow["resolverStatus"];
  childState: OperatorConsoleRow["childState"];
  reviewState?: OperatorConsoleRow["reviewState"];
  reviewNotes?: OperatorConsoleRow["reviewNotes"];
  evidenceCount: number;
  sourceTypes: string[];
  sourceTypeSummary: string;
  recoveryPriority: number;
  recoveryReasons: string[];
};

const BOOKING_HINT_HOSTS = [
  "booksy.com",
  "vagaro.com",
  "glossgenius.com",
  "fresha.com",
  "schedulicity.com",
  "square.site",
  "squareup.com",
  "styleseat.com",
];

function normalizeText(value?: string): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isProvisionalName(value?: string): boolean {
  const name = normalizeText(value);
  if (!name) return true;
  if (!name.includes(" ")) return true;
  return /(profile|provider|staff|member|artist|book|booking|detail|services?)/.test(name);
}

function sourceTypes(op: OperatorConsoleRow): string[] {
  const tags = new Set<string>();
  for (const row of op.evidence || []) {
    tags.add(row.source);
    if (row.evidenceType === "directory_listing") tags.add("directory");
    if (row.evidenceType === "suite_container") tags.add("container");
  }
  return [...tags];
}

function hasWebsiteHintInEvidence(op: OperatorConsoleRow): boolean {
  return (op.evidence || []).some((row) => {
    const urls = [row.website, row.sourceUrl].filter(Boolean) as string[];
    return urls.some((value) => value.startsWith("http"));
  });
}

function hasInternalDetailLinks(op: OperatorConsoleRow): boolean {
  return (op.evidence || []).some((row) => {
    if (!row.extracted || typeof row.extracted !== "object") return false;
    const links = (row.extracted as Record<string, unknown>).internalDetailLinks;
    return Array.isArray(links) && links.some((x) => typeof x === "string" && x.startsWith("http"));
  });
}

function hasLowQualityIdentityIndicators(op: OperatorConsoleRow): boolean {
  const values = [
    op.name,
    op.city,
    ...((op.evidence || []).flatMap((row) => [row.sourceUrl, row.name, row.city])),
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return values.some((value) =>
    [
      "access denied",
      "forbidden",
      "blocked",
      "captcha",
      "not found",
      "page not found",
      "unknown",
      "n/a",
      "unavailable",
    ].some((token) => value.includes(token))
  );
}

function likelySurfaceHints(op: OperatorConsoleRow): { bookingHint: boolean; instagramHint: boolean } {
  let bookingHint = false;
  let instagramHint = false;
  for (const row of op.evidence || []) {
    const extractedLinks =
      row.extracted && typeof row.extracted === "object" && Array.isArray((row.extracted as Record<string, unknown>).internalDetailLinks)
        ? (((row.extracted as Record<string, unknown>).internalDetailLinks as unknown[]) || []).filter(
            (x): x is string => typeof x === "string"
          )
        : [];
    const urls = [row.sourceUrl, row.website, row.booking, row.instagram, ...extractedLinks].filter(Boolean) as string[];
    for (const url of urls) {
      const lower = url.toLowerCase();
      if (lower.includes("instagram.com")) instagramHint = true;
      if (BOOKING_HINT_HOSTS.some((host) => lower.includes(host))) bookingHint = true;
    }
  }
  return { bookingHint, instagramHint };
}

function dedupeKey(op: OperatorConsoleRow): string {
  const name = normalizeText(op.name);
  if (op.childState === "not_child") return `${name}|${normalizeText(op.city)}`;
  return `${name}|${normalizeText(op.parentContainerId || op.city)}`;
}

function recoveryPriorityWithReasons(op: OperatorConsoleRow): { score: number; reasons: string[]; hintBoost: number } {
  const reasons: string[] = [];
  let score = 0;
  let hintBoost = 0;
  const evidenceRows = op.evidence || [];
  const evidenceCount = evidenceRows.length;
  const sources = sourceTypes(op);

  if (op.resolverStatus === "hot") {
    score += 40;
    reasons.push("hot status");
  } else if (op.resolverStatus === "enriched") {
    score += 28;
    reasons.push("enriched status");
  } else if (op.childState === "resolved_child") {
    score += 22;
    reasons.push("resolved child");
  }

  if (evidenceCount >= 6) {
    score += 18;
    reasons.push("high evidence count");
  } else if (evidenceCount >= 4) {
    score += 12;
    reasons.push("mid evidence count");
  } else if (evidenceCount >= 2) {
    score += 6;
    reasons.push("some evidence depth");
  }

  if ((op.name || "").trim() && !isProvisionalName(op.name) && normalizeText(op.name) !== "unknown") {
    score += 10;
    reasons.push("strong name");
  }
  if ((op.city || "").trim()) {
    score += 6;
    reasons.push("city present");
  }
  if (evidenceRows.some((row) => Boolean((row.address || "").trim()))) {
    score += 8;
    reasons.push("address present");
  }
  if ((op.canonical.phone || "").trim()) {
    score += 8;
    reasons.push("phone present");
  }

  if (sources.includes("directory")) {
    score += 12;
    reasons.push("directory-backed");
  }
  if (sources.includes("container") || op.childState !== "not_child") {
    score += 10;
    reasons.push("container-linked");
  }
  if (sources.includes("google") && sources.includes("directory")) {
    score += 8;
    reasons.push("google + directory mix");
  }
  if (hasWebsiteHintInEvidence(op) && !op.canonical.website) {
    score += 14;
    reasons.push("possible website hint");
    hintBoost += 14;
  }
  if (hasInternalDetailLinks(op)) {
    score += 12;
    reasons.push("internal detail links present");
  }

  const hints = likelySurfaceHints(op);
  if (hints.bookingHint && !op.canonical.booking) {
    score += 16;
    reasons.push("possible booking hint");
    hintBoost += 16;
  }
  if (hints.instagramHint && !op.canonical.instagram) {
    score += 12;
    reasons.push("possible instagram hint");
    hintBoost += 12;
  }

  if (op.childState === "provisional_child") {
    score -= 18;
    reasons.push("provisional child penalty");
  }
  if (evidenceCount <= 1) {
    score -= 12;
    reasons.push("single-evidence penalty");
  }
  const hasIdentity = Boolean((op.name || "").trim() && (op.city || "").trim());
  const pureContainerNoSignal = sources.includes("container") && !sources.includes("directory") && !hasIdentity;
  if (pureContainerNoSignal) {
    score -= 20;
    reasons.push("generic container-parent penalty");
  }
  if ((op.name || "").toLowerCase() === "unknown" || !hasIdentity) {
    score -= 10;
    reasons.push("weak identity penalty");
  }
  if (hasLowQualityIdentityIndicators(op)) {
    score -= 10;
    reasons.push("low-quality identity indicator penalty");
  }

  return { score: Math.max(0, Math.round(score)), reasons, hintBoost };
}

function noDirectSurfaces(op: OperatorConsoleRow): boolean {
  return !op.canonical.booking && !op.canonical.instagram && !op.canonical.website;
}

export function selectSurfaceRecoveryQueue(operators: OperatorConsoleRow[]): SurfaceRecoveryCandidate[] {
  const selected = operators
    .filter((op) => op.resolverStatus === "hot" || op.resolverStatus === "enriched" || op.childState === "resolved_child")
    .filter((op) => noDirectSurfaces(op))
    .map((op) => {
      const sources = sourceTypes(op);
      const scored = recoveryPriorityWithReasons(op);
      return {
        id: op.id,
        name: op.name,
        city: op.city,
        status: op.resolverStatus,
        childState: op.childState,
        reviewState: op.reviewState,
        reviewNotes: op.reviewNotes,
        evidenceCount: (op.evidence || []).length,
        sourceTypes: sources,
        sourceTypeSummary: sources.join(" / "),
        recoveryPriority: scored.score,
        recoveryReasons: scored.reasons,
      };
    })
    .sort((a, b) => b.recoveryPriority - a.recoveryPriority);
  const deduped = new Map<string, SurfaceRecoveryCandidate>();
  for (const candidate of selected) {
    const source = operators.find((x) => x.id === candidate.id);
    if (!source) continue;
    const key = dedupeKey(source);
    const existing = deduped.get(key);
    if (!existing || candidate.recoveryPriority > existing.recoveryPriority) deduped.set(key, candidate);
  }
  return [...deduped.values()].sort((a, b) => b.recoveryPriority - a.recoveryPriority);
}

export function writeSurfaceRecoveryQueue(candidates: SurfaceRecoveryCandidate[]): string {
  return writeSurfaceRecoveryQueueArtifact({
    generatedAt: new Date().toISOString(),
    total: candidates.length,
    queue: candidates,
  });
}

