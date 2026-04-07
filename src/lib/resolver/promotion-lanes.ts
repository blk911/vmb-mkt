import type { ResolverOperator } from "./types";

export type PromotionLane = "website_backed" | "directory_backed" | "container_adjacent" | "identity_only";

function hasDirectCanonicalSurface(op: ResolverOperator): boolean {
  return Boolean(op.canonicalBooking || op.canonicalInstagram);
}

function hasStrongIdentity(op: ResolverOperator): boolean {
  return Boolean(op.canonicalName && (op.canonicalAddress || op.canonicalCity || op.canonicalPhone));
}

export function classifyPromotionLane(operator: ResolverOperator): PromotionLane {
  const hasDirectoryEvidence = operator.sources.some((x) => x.source === "directory" || x.evidenceType === "directory_listing");
  const hasContainerClue = Boolean(
    operator.parentContainerId ||
      operator.sources.some((x) => x.source === "container" || x.evidenceType === "suite_container" || x.parentContainerName)
  );

  if (operator.canonicalWebsite && !hasDirectCanonicalSurface(operator)) return "website_backed";
  if (hasContainerClue) return "container_adjacent";
  if (hasDirectoryEvidence && !hasDirectCanonicalSurface(operator)) return "directory_backed";
  if (hasStrongIdentity(operator)) return "identity_only";
  return "identity_only";
}

export function laneExpectedQueryTokens(lane: PromotionLane): string[] {
  if (lane === "website_backed") return ["instagram", "booking", "http", "www."];
  if (lane === "directory_backed") return ["booking", "glossgenius", "styleseat", "vagaro", "fresha"];
  if (lane === "container_adjacent") return ["booking", "address", "city"];
  return ["phone", "address", "instagram"];
}

export function queriesMatchLaneStrategy(lane: PromotionLane, queries: string[]): boolean {
  const haystack = queries.join(" ").toLowerCase();
  const tokens = laneExpectedQueryTokens(lane);
  return tokens.some((token) => haystack.includes(token.toLowerCase()));
}

