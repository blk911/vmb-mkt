/**
 * Service signal overlay for Live Units — derived from existing row fields (no new backend).
 * Used for filtering, chips, and nails-led Work Mode without rigid category-only rules.
 */

export type ServiceSignal = "nails" | "hair" | "esthetics" | "spa";

/** Single-select entry angle filter (predictable UX vs multi-select). */
export type EntryAngleFilter = "any" | ServiceSignal;

/** Single vs multi-service targeting. */
export type ServiceScopeFilter = "any" | "single" | "multi";

export type DerivedServiceSignals = {
  hasNails: boolean;
  hasHair: boolean;
  hasEsthetics: boolean;
  hasSpa: boolean;
  serviceSignals: ServiceSignal[];
  serviceSignalCount: number;
  isMultiService: boolean;
  primaryServiceSignal: ServiceSignal | null;
};
