import type { DiagnosticCode } from "./types";

const LABELS: Record<DiagnosticCode, string> = {
  ADDR_MATCH: "Exact address match",
  ADDR_PARTIAL: "Partial address agreement",
  DIST_NEAR: "Very near distance",
  DIST_FAR: "Only loosely nearby",
  NAME_STRONG: "Strong name overlap",
  NAME_WEAK: "Weak name overlap",
  CATEGORY_MATCH: "Category aligned",
  CATEGORY_CONFLICT: "Category conflict",
  PERSON_NOT_SHOP: "Person record is not a shop anchor",
  NO_USABLE_ADDRESS: "No usable address support",
  MULTI_ANCHOR_CONFLICT: "Competing nearby shop anchors",
  SUITE_CONFLICT: "Suite or unit conflict",
  COMPETING_BRAND: "Different nearby brands",
  LOW_CONFIDENCE_ONLY: "Low confidence only",
  MERGED_BY_DOMINANT_ANCHOR: "Merged into dominant location anchor",
  HARD_LOCATION_LOCK: "Hard location lock passed",
  NEARBY_NOISE_NO_LOCK: "Excluded: nearby noise without location lock",
};

export function diagnosticLabel(code: DiagnosticCode): string {
  return LABELS[code] || code;
}
