import fs from "node:fs";
import path from "node:path";
import type { OperatorRecord } from "./types";

export type NormalizedCategory = "nails" | "lashes" | "brows" | "hair" | "spa" | "multi_service" | "unknown";

export type ReadyCoreOperator = OperatorRecord & {
  preferredContactSurface: "booking" | "instagram" | "website" | "phone" | "none";
  normalizedCategory: NormalizedCategory;
};

export const READY_CORE_ARTIFACT = "runtime-data/operator_ready_core.json";

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

export function normalizeOperatorCategory(operator: OperatorRecord): NormalizedCategory {
  const parts = [
    operator.category || "",
    operator.name || "",
    operator.sources.google?.category || "",
    operator.sources.google?.name || "",
  ];
  const text = parts.join(" ").toLowerCase();
  const hits = {
    nails: containsAny(text, ["nail", "manicure", "pedicure"]),
    lashes: containsAny(text, ["lash", "eyelash"]),
    brows: containsAny(text, ["brow", "eyebrow"]),
    hair: containsAny(text, ["hair", "barber", "stylist"]),
    spa: containsAny(text, ["spa", "facial", "esthetic", "massage", "skin"]),
  };

  const hitCount = Object.values(hits).filter(Boolean).length;
  if (hitCount > 1) return "multi_service";
  if (hits.nails) return "nails";
  if (hits.lashes) return "lashes";
  if (hits.brows) return "brows";
  if (hits.hair) return "hair";
  if (hits.spa) return "spa";
  return "unknown";
}

function isValidSurface(status?: "valid" | "dead" | "missing"): boolean {
  return status === "valid";
}

export function derivePreferredContactSurface(
  operator: OperatorRecord
): "booking" | "instagram" | "website" | "phone" | "none" {
  if (operator.canonical.booking && isValidSurface(operator.validation.bookingStatus)) return "booking";
  if (operator.canonical.instagram && isValidSurface(operator.validation.instagramStatus)) return "instagram";
  if (operator.canonical.website && isValidSurface(operator.validation.websiteStatus)) return "website";
  if (operator.canonical.phone) return "phone";
  return "none";
}

function contactSurfaceRank(surface: ReadyCoreOperator["preferredContactSurface"]): number {
  if (surface === "booking") return 5;
  if (surface === "instagram") return 4;
  if (surface === "website") return 3;
  if (surface === "phone") return 2;
  return 1;
}

export function selectReadyCoreOperators(operators: OperatorRecord[]): ReadyCoreOperator[] {
  const ready = operators
    .filter((op) => op.reviewState === "ready")
    .map((op) => ({
      ...op,
      preferredContactSurface: derivePreferredContactSurface(op),
      normalizedCategory: normalizeOperatorCategory(op),
    }));

  return ready.sort((a, b) => {
    const surfaceDiff = contactSurfaceRank(b.preferredContactSurface) - contactSurfaceRank(a.preferredContactSurface);
    if (surfaceDiff !== 0) return surfaceDiff;
    if (a.confidenceScore !== b.confidenceScore) return b.confidenceScore - a.confidenceScore;
    return (a.name || "").localeCompare(b.name || "");
  });
}

export function writeReadyCoreArtifact(operators: OperatorRecord[]): string {
  const ready = selectReadyCoreOperators(operators);
  const outPath = path.join(process.cwd(), READY_CORE_ARTIFACT);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(ready, null, 2)}\n`);
  return READY_CORE_ARTIFACT;
}

