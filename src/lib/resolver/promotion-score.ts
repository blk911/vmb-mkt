import type { ResolverOperator } from "./types";
import { classifyPromotionLane } from "./promotion-lanes";

function isStrongName(name?: string): boolean {
  const value = (name || "").trim();
  if (!value) return false;
  if (value.toLowerCase() === "unknown") return false;
  if (value.length < 3) return false;
  return true;
}

export function scorePromotionCandidate(operator: ResolverOperator): { score: number; reasons: string[] } {
  if (operator.status !== "enumerated") return { score: 0, reasons: [] };
  const reasons: string[] = [];
  let score = 0;

  if (operator.canonicalWebsite) {
    score += 18;
    reasons.push("has_website");
  }
  if (operator.canonicalPhone) {
    score += 18;
    reasons.push("has_phone");
  }
  if (operator.canonicalAddress) {
    score += 14;
    reasons.push("has_address");
  }
  if (operator.canonicalCity) {
    score += 10;
    reasons.push("has_city");
  }
  if (isStrongName(operator.canonicalName)) {
    score += 16;
    reasons.push("strong_name");
  }
  if (operator.sources.some((x) => x.source === "directory")) {
    score += 10;
    reasons.push("has_directory_evidence");
  }
  if (operator.sources.some((x) => x.source === "booking" || Boolean(x.booking))) {
    score += 12;
    reasons.push("booking_hints");
  }
  if (operator.parentContainerId || operator.sources.some((x) => x.source === "container" || x.evidenceType === "suite_container")) {
    score += 8;
    reasons.push("suite_container_clue");
  }
  if (operator.sources.length >= 2) {
    score += 10;
    reasons.push("multi_evidence");
  }

  const lane = classifyPromotionLane(operator);
  if (lane === "website_backed") {
    score += 35;
    reasons.push("lane_website_backed");
  } else if (lane === "directory_backed") {
    score += 30;
    reasons.push("lane_directory_backed");
  } else if (lane === "container_adjacent") {
    score += 18;
    reasons.push("lane_container_adjacent");
  } else {
    score += 8;
    reasons.push("lane_identity_only");
  }

  return { score, reasons };
}

