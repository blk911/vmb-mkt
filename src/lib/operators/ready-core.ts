import fs from "node:fs";
import path from "node:path";
import type { OperatorRecord } from "./types";
import { writeReadyCoreExportArtifacts } from "./ready-export";
import { loadResolverBackedOperatorsWithReview } from "./review-store";

export type NormalizedCategory = "nails" | "lashes" | "brows" | "hair" | "spa" | "multi_service" | "unknown";

export type ReadyCoreOperator = OperatorRecord & {
  preferredContactSurface: "booking" | "instagram" | "website" | "phone" | "none";
  normalizedCategory: NormalizedCategory;
  businessType: "solo_tech" | "salon" | "suite_based" | "unknown";
  contactPriority: "high" | "medium" | "low";
  readyBatchTag: string;
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

function normalizeCityForBatchTag(city?: string): string {
  const text = (city || "unknown").toLowerCase().trim();
  if (!text) return "unknown";
  return text.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function hasSuiteEvidence(operator: OperatorRecord): boolean {
  return (operator.evidence || []).some((row) => row.evidenceType === "suite_container" || row.source === "container");
}

function deriveBusinessType(operator: OperatorRecord, normalizedCategory: NormalizedCategory): ReadyCoreOperator["businessType"] {
  if (hasSuiteEvidence(operator)) return "suite_based";
  const text = [operator.name || "", operator.category || ""].join(" ").toLowerCase();
  if (containsAny(text, ["salon", "studio", "spa", "barber"])) return "salon";
  if (normalizedCategory !== "unknown" && !containsAny(text, ["salon", "spa", "studio"])) return "solo_tech";
  return "unknown";
}

function deriveContactPriority(operator: OperatorRecord): ReadyCoreOperator["contactPriority"] {
  const hasBooking = Boolean(operator.canonical.booking);
  const hasInstagram = Boolean(operator.canonical.instagram);
  const hasWebsite = Boolean(operator.canonical.website);
  const hasPhone = Boolean(operator.canonical.phone);
  if (hasBooking && hasInstagram) return "high";
  if (hasBooking || hasInstagram) return "medium";
  if (hasWebsite || hasPhone) return "low";
  return "low";
}

export function selectReadyCoreOperators(operators: OperatorRecord[]): ReadyCoreOperator[] {
  const ready = operators
    .filter((op) => op.reviewState === "ready")
    .map((op) => {
      const preferredContactSurface = derivePreferredContactSurface(op);
      const normalizedCategory = normalizeOperatorCategory(op);
      const businessType = deriveBusinessType(op, normalizedCategory);
      const contactPriority = deriveContactPriority(op);
      const readyBatchTag = `${normalizeCityForBatchTag(op.city)}_${normalizedCategory}`;
      return {
        ...op,
        preferredContactSurface,
        normalizedCategory,
        businessType,
        contactPriority,
        readyBatchTag,
      };
    });

  return ready.sort((a, b) => {
    const surfaceDiff = contactSurfaceRank(b.preferredContactSurface) - contactSurfaceRank(a.preferredContactSurface);
    if (surfaceDiff !== 0) return surfaceDiff;
    if (a.confidenceScore !== b.confidenceScore) return b.confidenceScore - a.confidenceScore;
    return (a.name || "").localeCompare(b.name || "");
  });
}

export function loadReadyCoreSourceOperators(): OperatorRecord[] {
  return loadResolverBackedOperatorsWithReview();
}

export function writeReadyCoreArtifact(operators?: OperatorRecord[]): string {
  const source = operators || loadReadyCoreSourceOperators();
  const ready = selectReadyCoreOperators(source);
  const outPath = path.join(process.cwd(), READY_CORE_ARTIFACT);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(ready, null, 2)}\n`);
  writeReadyCoreExportArtifacts(ready);
  return READY_CORE_ARTIFACT;
}

