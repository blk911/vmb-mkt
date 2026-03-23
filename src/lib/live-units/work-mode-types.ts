/**
 * Work Mode (Live Units) — operator queue presets and derived row state.
 * Review Mode filter state is unchanged; presets narrow the visible row set in Work Mode.
 */

export type LiveUnitsMode = "review" | "work";

export type WorkPresetId =
  | "QUEBEC_HIGH_VALUE"
  | "DOWNTOWN_DENSE"
  | "BOOKING_READY"
  | "NEEDS_REVIEW"
  | "NEW_LEADS";

export type WorkPriority = "high" | "ready" | "review" | "low";

export type WorkNextAction = "call" | "dm" | "review" | "research" | "skip" | "promote";

export type WorkDerivedState = {
  priority: WorkPriority;
  nextAction: WorkNextAction;
  matchesActivePreset: boolean;
  presetReason: string | null;
};

export type WorkPresetMeta = {
  id: WorkPresetId;
  label: string;
  shortHint: string;
};

export const WORK_PRESETS: WorkPresetMeta[] = [
  {
    id: "QUEBEC_HIGH_VALUE",
    label: "Quebec — High Value",
    shortHint: "Nail-led targets (incl. mixed-service w/ nail signal) in Quebec zone, high score, not rejected.",
  },
  {
    id: "DOWNTOWN_DENSE",
    label: "Downtown — Dense Targets",
    shortHint: "Downtown nail-led rows with storefront or dense neighbor signals.",
  },
  {
    id: "BOOKING_READY",
    label: "Booking Ready",
    shortHint: "Nail signal + online identity (e.g. website) and strong score.",
  },
  {
    id: "NEEDS_REVIEW",
    label: "Needs Review",
    shortHint: "Mid scores or ambiguous confidence — includes mixed-service rows.",
  },
  {
    id: "NEW_LEADS",
    label: "New Leads",
    shortHint: "Unreviewed rows (broadest).",
  },
];
