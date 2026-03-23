/**
 * Deterministic service-signal derivation from existing Live Unit fields.
 * Conservative when evidence is weak; supports multi-service without forcing a single label.
 */
import type { DerivedServiceSignals, EntryAngleFilter, ServiceScopeFilter, ServiceSignal } from "./service-signal-types";

export type ServiceSignalRowInput = {
  operational_category: string;
  subtype?: string;
  signal_mix: string;
  name_display?: string;
  explanation?: string;
};

/** Legacy nails category heuristic (subset of nails signal — kept for overlap checks). */
export function isNailsCategoryString(operationalCategory: string): boolean {
  const c = operationalCategory.toLowerCase();
  if (c.includes("nail") || c.includes("manicure") || c.includes("pedicure")) return true;
  if (c.includes("gel") && c.includes("nail")) return true;
  return false;
}

function normalizeHaystack(row: ServiceSignalRowInput): string {
  const parts = [
    row.operational_category,
    row.subtype ?? "",
    row.signal_mix ?? "",
    row.name_display ?? "",
    row.explanation ?? "",
  ];
  return parts.join(" | ").toLowerCase();
}

/**
 * v1 keyword rules — document assumptions inline.
 * Prefer phrase matches; avoid single ambiguous tokens unless category already suggests service.
 */
function detectNails(hay: string, categoryNails: boolean): boolean {
  if (categoryNails) return true;
  if (/\bnail\b/.test(hay) || /\bnails\b/.test(hay)) return true;
  if (hay.includes("manicure") || hay.includes("pedicure")) return true;
  if (hay.includes("acrylic") && hay.includes("nail")) return true;
  if (hay.includes("gel") && hay.includes("nail")) return true;
  if (hay.includes("dip powder")) return true;
  return false;
}

function detectHair(hay: string): boolean {
  // Exclude standalone "barber" unless paired with hair/salon language (conservative).
  const barberOnly = /\bbarber\b/.test(hay) && !hay.includes("hair") && !hay.includes("salon") && !hay.includes("stylist");
  if (barberOnly) return false;
  if (/\bhair\s+salon\b/.test(hay) || hay.includes("hair color") || hay.includes("haircut")) return true;
  if (hay.includes("balayage") || hay.includes("highlights") || hay.includes("blowout")) return true;
  if (/\bhair\s+studio\b/.test(hay) || /\bstylist\b/.test(hay)) return true;
  if (hay.includes("hair") && (hay.includes("salon") || hay.includes("spa"))) return true;
  return false;
}

function detectEsthetics(hay: string): boolean {
  if (hay.includes("esthetician") || hay.includes("esthetic")) return true;
  if (hay.includes("facial") || hay.includes("skincare") || hay.includes("skin care")) return true;
  if (hay.includes("waxing") || /\bwax\b/.test(hay)) return true;
  if (hay.includes("brow") || hay.includes("lash") || hay.includes("lashes")) return true;
  if (hay.includes("microblading")) return true;
  return false;
}

function detectSpa(hay: string): boolean {
  if (/\bday spa\b/.test(hay) || /\bmed spa\b/.test(hay)) return true;
  if (hay.includes("massage") && !/\bnail\b/.test(hay)) return true;
  if (hay.includes("body treatment") || hay.includes("spa package")) return true;
  if (/\bspa\b/.test(hay) && (hay.includes("massage") || hay.includes("facial") || hay.includes("body"))) return true;
  return false;
}

const SIGNAL_ORDER: ServiceSignal[] = ["nails", "hair", "esthetics", "spa"];

export function deriveServiceSignalsForRow(row: ServiceSignalRowInput): DerivedServiceSignals {
  const hay = normalizeHaystack(row);
  const categoryNails = isNailsCategoryString(row.operational_category);

  const hasNails = detectNails(hay, categoryNails);
  const hasHair = detectHair(hay);
  const hasEsthetics = detectEsthetics(hay);
  const hasSpa = detectSpa(hay);

  const flags: Record<ServiceSignal, boolean> = {
    nails: hasNails,
    hair: hasHair,
    esthetics: hasEsthetics,
    spa: hasSpa,
  };

  const serviceSignals = SIGNAL_ORDER.filter((s) => flags[s]);
  const serviceSignalCount = serviceSignals.length;
  const isMultiService = serviceSignalCount >= 2;

  /** Nails-led default when present; else first signal in canonical order. */
  let primaryServiceSignal: ServiceSignal | null = null;
  if (hasNails) primaryServiceSignal = "nails";
  else if (hasHair) primaryServiceSignal = "hair";
  else if (hasEsthetics) primaryServiceSignal = "esthetics";
  else if (hasSpa) primaryServiceSignal = "spa";

  return {
    hasNails,
    hasHair,
    hasEsthetics,
    hasSpa,
    serviceSignals,
    serviceSignalCount,
    isMultiService,
    primaryServiceSignal,
  };
}

export function serviceSignalLabel(s: ServiceSignal): string {
  switch (s) {
    case "nails":
      return "Nails";
    case "hair":
      return "Hair";
    case "esthetics":
      return "Esthetics";
    case "spa":
      return "Spa";
    default:
      return s;
  }
}

export function rowMatchesEntryAngle(signals: DerivedServiceSignals, filter: EntryAngleFilter): boolean {
  if (filter === "any") return true;
  if (filter === "nails") return signals.hasNails;
  if (filter === "hair") return signals.hasHair;
  if (filter === "esthetics") return signals.hasEsthetics;
  if (filter === "spa") return signals.hasSpa;
  return true;
}

export function rowMatchesServiceScope(signals: DerivedServiceSignals, filter: ServiceScopeFilter): boolean {
  if (filter === "any") return true;
  if (filter === "single") return !signals.isMultiService;
  if (filter === "multi") return signals.isMultiService;
  return true;
}
