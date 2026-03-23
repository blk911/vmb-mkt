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
    label: "Quebec Corridor — High Value",
    shortHint: "Nail targets in Quebec zone, high tuned score, not rejected.",
  },
  {
    id: "DOWNTOWN_DENSE",
    label: "Downtown Core — Dense Targets",
    shortHint: "Downtown nail rows with storefront or dense neighbor signals.",
  },
  {
    id: "BOOKING_READY",
    label: "Booking Ready",
    shortHint: "Nails + online identity (e.g. website) and strong score.",
  },
  {
    id: "NEEDS_REVIEW",
    label: "Needs Review",
    shortHint: "Mid scores or candidate/ambiguous confidence — human decision.",
  },
  {
    id: "NEW_LEADS",
    label: "New Leads",
    shortHint: "Unreviewed rows (broadest).",
  },
];
