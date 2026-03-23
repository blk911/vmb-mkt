"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import LiveUnitsShell from "@/components/admin/live-units/LiveUnitsShell";
import {
  ActionButton,
  FilterField,
  FilterGrid,
  PillButton,
} from "@/components/admin/live-units/LiveUnitsFields";
import WorkModePanel from "@/app/admin/live-units/_components/WorkModePanel";
import WorkModeToggle from "@/app/admin/live-units/_components/WorkModeToggle";
import WorkNextActionBadge from "@/app/admin/live-units/_components/WorkNextActionBadge";
import WorkPriorityBadge from "@/app/admin/live-units/_components/WorkPriorityBadge";
import type { LiveUnitsMode, WorkPresetId } from "@/lib/live-units/work-mode-types";
import {
  applyWorkPreset,
  deriveWorkStateForRow,
  pickDefaultWorkPreset,
  summarizeWorkMode,
} from "@/lib/live-units/work-mode-logic";
import {
  deriveWorkResolutionState,
  type LiveUnitsFilterSnapshot,
  type WorkResolutionSuggestedAction,
} from "@/lib/live-units/work-mode-resolution";
import WorkModeResolutionStrip from "@/app/admin/live-units/_components/WorkModeResolutionStrip";
import MultiServiceBadge from "@/app/admin/live-units/_components/MultiServiceBadge";
import ServiceSignalChips from "@/app/admin/live-units/_components/ServiceSignalChips";
import type { EntryAngleFilter, ServiceScopeFilter } from "@/lib/live-units/service-signal-types";
import {
  deriveServiceSignalsForRow,
  rowMatchesEntryAngle,
  rowMatchesServiceScope,
  serviceSignalLabel,
} from "@/lib/live-units/service-signal-logic";
import { deriveEntityDisplayStateForRow } from "@/lib/live-units/entity-display-logic";
import EntityKindBadge from "@/app/admin/live-units/_components/EntityKindBadge";
import EntryOptionChips from "@/app/admin/live-units/_components/EntryOptionChips";
import RelationshipHintBadge from "@/app/admin/live-units/_components/RelationshipHintBadge";

type Confidence = "strong" | "likely" | "candidate_review" | "ambiguous";
type ReviewStatus = "approved" | "rejected" | "watch" | "needs_research";
type ReviewFilter = "all" | "unreviewed" | ReviewStatus;
type ScoreBand = "all" | "0-54" | "55-69" | "70-84" | "85-100";
type SortKey =
  | "tuned_score"
  | "original_score"
  | "confidence"
  | "zone"
  | "category"
  | "city"
  | "signal_mix"
  | "review_status"
  | "name"
  | "nearby_shop_license"
  | "nearby_techs";
type ColumnSortDir = "asc" | "desc";
type SubtypeFilter = "all" | "storefront" | "suite" | "unknown";
type TuningFilter = "all" | "changed" | "boosted" | "downgraded" | "unchanged";
type PresetId =
  | "unreviewed_likely"
  | "candidate_review"
  | "ambiguous"
  | "changed_by_feedback"
  | "high_score_storefront"
  | "suite_related";

type LiveUnitRow = {
  live_unit_id: string;
  entity_id?: string;
  name_display: string;
  operational_category: string;
  subtype?: string;
  confidence: Confidence;
  tuned_confidence?: Confidence;
  signal_mix: string;
  city: string | null;
  zip: string | null;
  google_place_id?: string | null;
  dora_license_id?: string | null;
  entity_score: number;
  tuned_entity_score?: number;
  explanation: string;
  raw_snippets?: {
    google?: {
      id?: string;
      name?: string;
      address?: string;
      website_domain?: string;
      zone_id?: string;
      zone_name?: string;
    };
    dora?: {
      address_key?: string;
      license_row_ids?: string[];
      raw_names?: string[];
    };
  };
  feedback_tuning?: {
    original_entity_score?: number;
    original_confidence?: Confidence;
    score_delta?: number;
    explanation?: string;
  };
  shop_license?: string | null;
  shop_license_name?: string | null;
  shop_distance?: number | null;
  association_confidence?: "strong" | "likely" | "weak" | null;
  tech_count_nearby?: number;
};

type ReviewDecision = {
  live_unit_id: string;
  review_status: ReviewStatus;
  updated_at: string;
  updated_by?: string;
};

type SalonTechLinkReviewDecision = {
  entity_id: string;
  tech_id: string;
  review_status: "confirmed" | "rejected" | "watch";
  note?: string;
  updated_at: string;
  updated_by?: string;
};

type ShopIndexRow = {
  shop_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  license_id: string;
};

type TechAssociationRow = {
  shop_license_id: string;
  shop_name: string;
  tech_row_id: string;
  tech_license_id: string;
  tech_name: string;
  tech_category: string;
  address_key: string;
  distance_to_shop: number;
  association_confidence: "strong" | "likely" | "weak";
  city?: string;
  zip?: string;
  license_type?: string;
  tech_lat?: number | null;
  tech_lon?: number | null;
};

type BulkActionKind = ReviewStatus | "clear";

type Props = {
  rows: LiveUnitRow[];
  source: "shop_context" | "tuned" | "base";
  initialReviewState: Record<string, ReviewDecision>;
  initialSalonTechReviewState: Record<string, SalonTechLinkReviewDecision>;
  shopIndex: ShopIndexRow[];
  techAssociations: TechAssociationRow[];
};

const CONFIDENCE_OPTIONS: Array<"all" | Confidence> = [
  "all",
  "strong",
  "likely",
  "candidate_review",
  "ambiguous",
];
const REVIEW_FILTER_OPTIONS: ReviewFilter[] = [
  "all",
  "unreviewed",
  "approved",
  "rejected",
  "watch",
  "needs_research",
];
const REVIEW_ACTIONS: ReviewStatus[] = ["approved", "rejected", "watch", "needs_research"];
const BULK_VISIBLE_ACTIONS: BulkActionKind[] = ["approved", "watch", "needs_research", "clear"];
const SCORE_BANDS: ScoreBand[] = ["all", "0-54", "55-69", "70-84", "85-100"];
const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "tuned_score", label: "Tuned Score" },
  { value: "original_score", label: "Original Score" },
  { value: "confidence", label: "Confidence" },
  { value: "zone", label: "Zone" },
  { value: "category", label: "Category" },
  { value: "city", label: "City" },
  { value: "signal_mix", label: "Signal Mix" },
  { value: "review_status", label: "Review Status" },
  { value: "name", label: "Name" },
  { value: "nearby_shop_license", label: "Nearby Shop License" },
  { value: "nearby_techs", label: "Nearby Techs" },
];

/** Columns in the results table that support click-to-sort (and reverse). */
const COLUMN_SORT_KEYS = new Set<SortKey>([
  "name",
  "category",
  "zone",
  "city",
  "tuned_score",
  "review_status",
  "nearby_shop_license",
  "nearby_techs",
]);

/** Default direction when selecting a sort (dropdown or first click on a column). */
function defaultSortDirForKey(key: SortKey): ColumnSortDir {
  if (key === "tuned_score" || key === "original_score" || key === "nearby_techs" || key === "confidence") return "desc";
  if (key === "review_status") return "desc";
  return "asc";
}
const SUBTYPE_OPTIONS: Array<{ value: SubtypeFilter; label: string }> = [
  { value: "all", label: "All subtypes" },
  { value: "storefront", label: "Storefront" },
  { value: "suite", label: "Suite" },
  { value: "unknown", label: "Unknown" },
];
const TUNING_FILTER_OPTIONS: Array<{ value: TuningFilter; label: string }> = [
  { value: "all", label: "All tuning states" },
  { value: "changed", label: "Only tuned changes" },
  { value: "boosted", label: "Boosted" },
  { value: "downgraded", label: "Downgraded" },
  { value: "unchanged", label: "Unchanged" },
];
const PRESETS: Array<{ id: PresetId; label: string }> = [
  { id: "unreviewed_likely", label: "Unreviewed likely" },
  { id: "candidate_review", label: "Candidate review" },
  { id: "ambiguous", label: "Ambiguous" },
  { id: "changed_by_feedback", label: "Changed by feedback" },
  { id: "high_score_storefront", label: "High-score storefront" },
  { id: "suite_related", label: "Suite-related rows" },
];

function formatSignalMix(value: string) {
  return value.replaceAll("_", " ").replaceAll("+", " + ");
}

function formatReviewLabel(value: string) {
  return value.replaceAll("_", " ");
}

function actionLabel(value: BulkActionKind, scope: "selected" | "visible" | "row") {
  if (value === "approved") return scope === "row" ? "Approve" : `Approve ${scope}`;
  if (value === "rejected") return scope === "row" ? "Reject" : `Reject ${scope}`;
  if (value === "watch") return scope === "row" ? "Watch" : `Watch ${scope}`;
  if (value === "needs_research") return scope === "row" ? "Needs Research" : `Needs Research ${scope}`;
  return scope === "row" ? "Clear" : `Clear ${scope}`;
}

function getEffectiveScore(row: LiveUnitRow) {
  return typeof row.tuned_entity_score === "number" ? row.tuned_entity_score : row.entity_score;
}

function getEffectiveConfidence(row: LiveUnitRow): Confidence {
  return row.tuned_confidence || row.confidence;
}

function getReviewStatusRank(status: ReviewStatus | "unreviewed") {
  if (status === "approved") return 5;
  if (status === "needs_research") return 4;
  if (status === "watch") return 3;
  if (status === "rejected") return 2;
  return 1;
}

function getZoneId(row: LiveUnitRow) {
  return row.raw_snippets?.google?.zone_id || "NO_ZONE";
}

function getZoneName(row: LiveUnitRow) {
  return row.raw_snippets?.google?.zone_name || "No zone";
}

function hasFeedbackTuning(row: LiveUnitRow) {
  return (
    typeof row.tuned_entity_score === "number" ||
    typeof row.feedback_tuning?.score_delta === "number" ||
    !!row.tuned_confidence
  );
}

function getScoreDelta(row: LiveUnitRow) {
  return row.feedback_tuning?.score_delta || 0;
}

function getTuningState(row: LiveUnitRow): Exclude<TuningFilter, "all" | "changed"> {
  const delta = getScoreDelta(row);
  if (delta > 0) return "boosted";
  if (delta < 0) return "downgraded";
  return "unchanged";
}

function scoreBandFor(score: number): Exclude<ScoreBand, "all"> {
  if (score >= 85) return "85-100";
  if (score >= 70) return "70-84";
  if (score >= 55) return "55-69";
  return "0-54";
}

function confidenceRank(confidence: Confidence) {
  if (confidence === "strong") return 4;
  if (confidence === "likely") return 3;
  if (confidence === "candidate_review") return 2;
  return 1;
}

function summaryCounts(rows: LiveUnitRow[]) {
  return {
    total: rows.length,
    approved: rows.filter((row) => getEffectiveConfidence(row) === "strong").length,
    candidate_review: rows.filter((row) => getEffectiveConfidence(row) === "candidate_review").length,
    ambiguous: rows.filter((row) => getEffectiveConfidence(row) === "ambiguous").length,
    boosted: rows.filter((row) => getScoreDelta(row) > 0).length,
    downgraded: rows.filter((row) => getScoreDelta(row) < 0).length,
  };
}

function confidenceBadgeClass(confidence: Confidence) {
  if (confidence === "strong") return "bg-emerald-100 text-emerald-800";
  if (confidence === "likely") return "bg-sky-100 text-sky-800";
  if (confidence === "ambiguous") return "bg-amber-100 text-amber-800";
  return "bg-neutral-100 text-neutral-700";
}

function scoreBadgeClass(score: number) {
  if (score >= 85) return "bg-emerald-100 text-emerald-800";
  if (score >= 70) return "bg-sky-100 text-sky-800";
  if (score >= 55) return "bg-amber-100 text-amber-800";
  return "bg-neutral-100 text-neutral-700";
}

function reviewBadgeClass(status: ReviewStatus | "unreviewed") {
  if (status === "approved") return "bg-emerald-100 text-emerald-800";
  if (status === "rejected") return "bg-rose-100 text-rose-800";
  if (status === "watch") return "bg-amber-100 text-amber-800";
  if (status === "needs_research") return "bg-violet-100 text-violet-800";
  return "bg-neutral-100 text-neutral-600";
}

function techAssociationBadgeClass(status: "confirmed" | "likely" | "nearby" | "conflicting" | "rejected" | "watch" | "unreviewed") {
  if (status === "confirmed") return "bg-emerald-100 text-emerald-800";
  if (status === "likely") return "bg-sky-100 text-sky-800";
  if (status === "nearby") return "bg-neutral-100 text-neutral-700";
  if (status === "conflicting") return "bg-amber-100 text-amber-800";
  if (status === "rejected") return "bg-rose-100 text-rose-800";
  if (status === "watch") return "bg-amber-100 text-amber-800";
  return "bg-neutral-100 text-neutral-600";
}

function reviewSummaryCounts(rows: LiveUnitRow[], reviewState: Record<string, ReviewDecision>) {
  const reviewed = rows.filter((row) => !!reviewState[row.live_unit_id]).length;
  return {
    reviewed,
    unreviewed: rows.filter((row) => !reviewState[row.live_unit_id]).length,
    approved: rows.filter((row) => reviewState[row.live_unit_id]?.review_status === "approved").length,
    rejected: rows.filter((row) => reviewState[row.live_unit_id]?.review_status === "rejected").length,
    watch: rows.filter((row) => reviewState[row.live_unit_id]?.review_status === "watch").length,
    needs_research: rows.filter((row) => reviewState[row.live_unit_id]?.review_status === "needs_research").length,
  };
}

function tuningBadgeClass(row: LiveUnitRow) {
  const delta = row.feedback_tuning?.score_delta || 0;
  if (delta > 0) return "bg-emerald-100 text-emerald-800";
  if (delta < 0) return "bg-amber-100 text-amber-800";
  return "bg-neutral-100 text-neutral-600";
}

function tuningLabel(row: LiveUnitRow) {
  const delta = getScoreDelta(row);
  if (delta > 0) return `boosted +${delta}`;
  if (delta < 0) return `downgraded ${delta}`;
  return "unchanged";
}

function entityIdFor(row: LiveUnitRow) {
  return row.entity_id || row.live_unit_id;
}

function linkedGoogleCount(row: LiveUnitRow) {
  return row.raw_snippets?.google ? 1 : 0;
}

function linkedDoraCount(row: LiveUnitRow) {
  return row.raw_snippets?.dora?.license_row_ids?.length || (row.dora_license_id ? 1 : 0);
}

function duplicateCountCollapsed(row: LiveUnitRow) {
  return 0;
}

function techReviewKey(entityId: string, techId: string) {
  return `${entityId}::${techId}`;
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(value: string) {
  return normalizeName(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !["salon", "studio", "spa", "llc", "inc", "bar", "shop"].includes(token));
}

function tokenOverlap(a: string, b: string) {
  const aTokens = new Set(nameTokens(a));
  const bTokens = new Set(nameTokens(b));
  if (!aTokens.size || !bTokens.size) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }
  return overlap;
}

function formatAddressKey(value?: string | null) {
  if (!value) return null;
  return value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

function buildShopAddress(shop?: ShopIndexRow | null) {
  if (!shop) return null;
  return [shop.address, shop.city, shop.state, shop.zip].filter(Boolean).join(", ");
}

function categoryCompatibility(entityCategory: string, techCategory: string) {
  if (entityCategory === techCategory) return 2;
  if (entityCategory === "beauty") return 1;
  if (entityCategory === "spa" && techCategory === "esthe") return 1;
  if (entityCategory === "hair" && techCategory === "beauty") return 1;
  return 0;
}

function googleAddressFor(row: LiveUnitRow) {
  return row.raw_snippets?.google?.address || null;
}

function doraEvidenceTier(row: LiveUnitRow) {
  const linked = linkedDoraCount(row);
  if (linked > 0 && row.shop_license) return 3;
  if (linked > 0 || row.dora_license_id) return 2;
  if (row.shop_license || (row.tech_count_nearby || 0) > 0 || row.signal_mix.includes("dora")) return 1;
  return 0;
}

function renderDoraTierDots(tier: number) {
  return [0, 1, 2]
    .map((index) => (index < tier ? "●" : "○"))
    .join("");
}

function signalStatusFor(row: LiveUnitRow, review?: ReviewDecision) {
  const confidence = getEffectiveConfidence(row);
  if (confidence === "strong" && review?.review_status === "approved") {
    return { key: "confirmed", color: "bg-red-600", label: "Confirmed" };
  }
  if (confidence === "likely" || confidence === "strong") {
    return { key: "likely", color: "bg-orange-500", label: "Likely" };
  }
  return { key: "review", color: "bg-yellow-400", label: "Review" };
}

export default function LiveUnitsClient({
  rows,
  source,
  initialReviewState,
  initialSalonTechReviewState,
  shopIndex,
  techAssociations,
}: Props) {
  const [confidence, setConfidence] = useState<"all" | Confidence>("all");
  const [signalMix, setSignalMix] = useState("all");
  const [category, setCategory] = useState("all");
  const [zone, setZone] = useState("all");
  const [city, setCity] = useState("all");
  const [zipQuery, setZipQuery] = useState("");
  const [scoreBand, setScoreBand] = useState<ScoreBand>("all");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [subtypeFilter, setSubtypeFilter] = useState<SubtypeFilter>("all");
  const [tuningFilter, setTuningFilter] = useState<TuningFilter>("all");
  const [entryAngleFilter, setEntryAngleFilter] = useState<EntryAngleFilter>("any");
  const [serviceScopeFilter, setServiceScopeFilter] = useState<ServiceScopeFilter>("any");
  const [sortKey, setSortKey] = useState<SortKey>("tuned_score");
  const [sortDir, setSortDir] = useState<ColumnSortDir>("desc");
  const [reviewState, setReviewState] = useState<Record<string, ReviewDecision>>(initialReviewState);
  const [salonTechReviewState, setSalonTechReviewState] = useState<Record<string, SalonTechLinkReviewDecision>>(
    initialSalonTechReviewState
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openEntityId, setOpenEntityId] = useState<string | null>(null);
  const [openSignalPopoverId, setOpenSignalPopoverId] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<PresetId | null>(null);
  const [savingLiveUnitId, setSavingLiveUnitId] = useState<string | null>(null);
  const [savingBulkAction, setSavingBulkAction] = useState<string | null>(null);
  const [savingTechActionKey, setSavingTechActionKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [liveUnitsMode, setLiveUnitsMode] = useState<LiveUnitsMode>("review");
  const [workPresetId, setWorkPresetId] = useState<WorkPresetId | null>(null);
  const [usePresetOnly, setUsePresetOnly] = useState(true);

  const counts = useMemo(() => summaryCounts(rows), [rows]);
  const reviewCounts = useMemo(() => reviewSummaryCounts(rows, reviewState), [rows, reviewState]);
  const reviewedPercent = rows.length ? ((reviewCounts.reviewed / rows.length) * 100).toFixed(1) : "0.0";

  const signalMixOptions = useMemo(() => {
    return ["all", ...Array.from(new Set(rows.map((row) => row.signal_mix))).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const categoryOptions = useMemo(() => {
    return [
      "all",
      ...Array.from(new Set(rows.map((row) => row.operational_category))).sort((a, b) => a.localeCompare(b)),
    ];
  }, [rows]);

  const zoneOptions = useMemo(() => {
    const zoneMap = new Map<string, string>();
    for (const row of rows) {
      zoneMap.set(getZoneId(row), getZoneName(row));
    }
    return [
      { value: "all", label: "All zones" },
      ...Array.from(zoneMap.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, label]) => ({ value, label })),
    ];
  }, [rows]);

  const cityOptions = useMemo(() => {
    return [
      { value: "all", label: "All cities" },
      ...Array.from(new Set(rows.map((row) => (row.city || "").trim()).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value, label: value })),
    ];
  }, [rows]);

  const serviceSignalsByUnitId = useMemo(() => {
    const m = new Map<string, ReturnType<typeof deriveServiceSignalsForRow>>();
    for (const row of rows) {
      m.set(row.live_unit_id, deriveServiceSignalsForRow(row));
    }
    return m;
  }, [rows]);

  const entityDisplayByUnitId = useMemo(() => {
    const m = new Map<string, ReturnType<typeof deriveEntityDisplayStateForRow>>();
    for (const row of rows) {
      m.set(row.live_unit_id, deriveEntityDisplayStateForRow(row));
    }
    return m;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedZipQuery = zipQuery.trim().toLowerCase();
    return rows
      .filter((row) => (confidence === "all" ? true : getEffectiveConfidence(row) === confidence))
      .filter((row) => (signalMix === "all" ? true : row.signal_mix === signalMix))
      .filter((row) => (category === "all" ? true : row.operational_category === category))
      .filter((row) => (zone === "all" ? true : getZoneId(row) === zone))
      .filter((row) => (city === "all" ? true : row.city === city))
      .filter((row) => (normalizedZipQuery ? (row.zip || "").toLowerCase().includes(normalizedZipQuery) : true))
      .filter((row) => (scoreBand === "all" ? true : scoreBandFor(getEffectiveScore(row)) === scoreBand))
      .filter((row) => {
        const reviewStatus = reviewState[row.live_unit_id]?.review_status;
        if (reviewFilter === "all") return true;
        if (reviewFilter === "unreviewed") return !reviewStatus;
        return reviewStatus === reviewFilter;
      })
      .filter((row) => (subtypeFilter === "all" ? true : (row.subtype || "unknown") === subtypeFilter))
      .filter((row) => {
        if (tuningFilter === "all") return true;
        if (tuningFilter === "changed") return getScoreDelta(row) !== 0;
        return getTuningState(row) === tuningFilter;
      })
      .filter((row) => {
        const sig = serviceSignalsByUnitId.get(row.live_unit_id);
        if (!sig) return true;
        return rowMatchesEntryAngle(sig, entryAngleFilter) && rowMatchesServiceScope(sig, serviceScopeFilter);
      })
      .sort((a, b) => {
        const reviewStatusA = (reviewState[a.live_unit_id]?.review_status || "unreviewed") as ReviewStatus | "unreviewed";
        const reviewStatusB = (reviewState[b.live_unit_id]?.review_status || "unreviewed") as ReviewStatus | "unreviewed";

        if (sortKey === "tuned_score") {
          const sa = getEffectiveScore(a);
          const sb = getEffectiveScore(b);
          if (sa !== sb) return sortDir === "desc" ? sb - sa : sa - sb;
        } else if (sortKey === "original_score") {
          if (a.entity_score !== b.entity_score) {
            return sortDir === "desc" ? b.entity_score - a.entity_score : a.entity_score - b.entity_score;
          }
        } else if (sortKey === "confidence") {
          const ca = confidenceRank(getEffectiveConfidence(a));
          const cb = confidenceRank(getEffectiveConfidence(b));
          if (ca !== cb) return sortDir === "desc" ? cb - ca : ca - cb;
        } else if (sortKey === "zone") {
          const zoneCompare = getZoneName(a).localeCompare(getZoneName(b));
          if (zoneCompare !== 0) return sortDir === "asc" ? zoneCompare : -zoneCompare;
        } else if (sortKey === "category") {
          const categoryCompare = a.operational_category.localeCompare(b.operational_category);
          if (categoryCompare !== 0) return sortDir === "asc" ? categoryCompare : -categoryCompare;
        } else if (sortKey === "city") {
          const cityZipKey = (r: LiveUnitRow) => `${r.city || ""}|${r.zip || ""}`;
          const cityCompare = cityZipKey(a).localeCompare(cityZipKey(b), undefined, { sensitivity: "base" });
          if (cityCompare !== 0) return sortDir === "asc" ? cityCompare : -cityCompare;
        } else if (sortKey === "signal_mix") {
          const signalCompare = a.signal_mix.localeCompare(b.signal_mix);
          if (signalCompare !== 0) return sortDir === "asc" ? signalCompare : -signalCompare;
        } else if (sortKey === "review_status") {
          const ra = getReviewStatusRank(reviewStatusA);
          const rb = getReviewStatusRank(reviewStatusB);
          if (ra !== rb) return sortDir === "desc" ? rb - ra : ra - rb;
        } else if (sortKey === "name") {
          const dirMult = sortDir === "asc" ? 1 : -1;
          const cmp = a.name_display.localeCompare(b.name_display, undefined, { sensitivity: "base" });
          if (cmp !== 0) return cmp * dirMult;
        } else if (sortKey === "nearby_shop_license") {
          const dirMult = sortDir === "asc" ? 1 : -1;
          const sa = (a.shop_license_name || "").trim();
          const sb = (b.shop_license_name || "").trim();
          const cmp = sa.localeCompare(sb, undefined, { sensitivity: "base" });
          if (cmp !== 0) return cmp * dirMult;
        } else if (sortKey === "nearby_techs") {
          const dirMult = sortDir === "asc" ? 1 : -1;
          const na = a.tech_count_nearby ?? 0;
          const nb = b.tech_count_nearby ?? 0;
          if (na !== nb) return (na - nb) * dirMult;
        }

        return [getZoneName(a), a.operational_category, a.city ?? "", a.zip ?? "", a.name_display].join("|").localeCompare(
          [getZoneName(b), b.operational_category, b.city ?? "", b.zip ?? "", b.name_display].join("|")
        );
      });
  }, [
    category,
    city,
    confidence,
    entryAngleFilter,
    reviewFilter,
    reviewState,
    rows,
    scoreBand,
    serviceScopeFilter,
    serviceSignalsByUnitId,
    signalMix,
    sortDir,
    sortKey,
    subtypeFilter,
    tuningFilter,
    zipQuery,
    zone,
  ]);

  const filterSnapshot = useMemo(
    (): LiveUnitsFilterSnapshot => ({
      confidence,
      signalMix,
      category,
      zone,
      city,
      zipQuery,
      scoreBand,
      reviewFilter,
      subtypeFilter,
      tuningFilter,
      entryAngle: entryAngleFilter,
      serviceScope: serviceScopeFilter,
    }),
    [
      category,
      city,
      confidence,
      entryAngleFilter,
      reviewFilter,
      scoreBand,
      serviceScopeFilter,
      signalMix,
      subtypeFilter,
      tuningFilter,
      zipQuery,
      zone,
    ]
  );

  const workModeBundle = useMemo(() => {
    if (liveUnitsMode !== "work") return null;
    if (!workPresetId) return { displayRows: filteredRows, resolution: null };
    const getReviewStatus = (id: string) => reviewState[id]?.review_status;
    const presetRows = applyWorkPreset(rows, workPresetId, getReviewStatus);
    const presetOnReviewFiltered = applyWorkPreset(filteredRows, workPresetId, getReviewStatus);
    const resolution = deriveWorkResolutionState({
      allRows: rows,
      presetRows,
      presetOnReviewFiltered,
      usePresetOnly,
      filters: filterSnapshot,
      activePresetId: workPresetId,
      getReviewStatus,
    });
    const displayRows = usePresetOnly ? presetRows : presetOnReviewFiltered;
    return { displayRows, resolution };
  }, [filteredRows, filterSnapshot, liveUnitsMode, reviewState, rows, usePresetOnly, workPresetId]);

  const displayRows = useMemo(() => {
    if (liveUnitsMode !== "work") return filteredRows;
    return workModeBundle!.displayRows;
  }, [filteredRows, liveUnitsMode, workModeBundle]);

  const workResolution = workModeBundle?.resolution ?? null;

  const workSummary = useMemo(() => {
    const base = liveUnitsMode === "work" ? rows : filteredRows;
    return summarizeWorkMode(base, (id) => reviewState[id]?.review_status);
  }, [filteredRows, liveUnitsMode, reviewState, rows]);

  useEffect(() => {
    if (liveUnitsMode !== "work" || workPresetId !== null) return;
    setWorkPresetId(pickDefaultWorkPreset(rows, (id) => reviewState[id]?.review_status));
  }, [liveUnitsMode, workPresetId, reviewState, rows]);

  function resetReviewFiltersToDefaults() {
    setConfidence("all");
    setSignalMix("all");
    setCategory("all");
    setZone("all");
    setCity("all");
    setZipQuery("");
    setScoreBand("all");
    setReviewFilter("all");
    setSubtypeFilter("all");
    setTuningFilter("all");
    setEntryAngleFilter("any");
    setServiceScopeFilter("any");
    setActivePreset(null);
  }

  function handleWorkResolutionAction(action: WorkResolutionSuggestedAction) {
    if (action.action === "use_preset_only") setUsePresetOnly(true);
    else if (action.action === "clear_filters") resetReviewFiltersToDefaults();
    else if (action.action === "switch_preset" && action.targetPresetId) setWorkPresetId(action.targetPresetId);
    else if (action.action === "open_review") setLiveUnitsMode("review");
  }

  const visibleIds = useMemo(() => displayRows.map((row) => row.live_unit_id), [displayRows]);
  const selectedVisibleIds = useMemo(
    () => visibleIds.filter((id) => selectedIds.includes(id)),
    [selectedIds, visibleIds]
  );
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleIds.length === visibleIds.length;
  const someVisibleSelected = selectedVisibleIds.length > 0 && !allVisibleSelected;
  const selectedEntity = useMemo(
    () =>
      displayRows.find((row) => entityIdFor(row) === openEntityId) ||
      filteredRows.find((row) => entityIdFor(row) === openEntityId) ||
      rows.find((row) => entityIdFor(row) === openEntityId) ||
      null,
    [displayRows, filteredRows, openEntityId, rows]
  );
  const shopByLicenseId = useMemo(
    () => new Map(shopIndex.map((shop) => [shop.license_id, shop] as const)),
    [shopIndex]
  );
  const selectedEntityShop = useMemo(
    () => (selectedEntity?.shop_license ? shopByLicenseId.get(selectedEntity.shop_license) || null : null),
    [selectedEntity, shopByLicenseId]
  );
  const selectedEntityAddresses = useMemo(() => {
    if (!selectedEntity) return [];
    return [
      {
        label: "Salon / entity address",
        value: googleAddressFor(selectedEntity) || formatAddressKey(selectedEntity.raw_snippets?.dora?.address_key) || buildShopAddress(selectedEntityShop),
      },
      {
        label: "DORA shop registration address",
        value: buildShopAddress(selectedEntityShop),
      },
      {
        label: "Matched evidence address",
        value: formatAddressKey(selectedEntity.raw_snippets?.dora?.address_key),
      },
    ].filter((item) => item.value);
  }, [selectedEntity, selectedEntityShop]);
  const selectedEntitySignal = useMemo(
    () => (selectedEntity ? signalStatusFor(selectedEntity, reviewState[selectedEntity.live_unit_id]) : null),
    [reviewState, selectedEntity]
  );
  const peerEntitiesByShop = useMemo(() => {
    const map = new Map<string, LiveUnitRow[]>();
    for (const row of rows) {
      if (!row.shop_license) continue;
      if (!map.has(row.shop_license)) map.set(row.shop_license, []);
      map.get(row.shop_license)!.push(row);
    }
    return map;
  }, [rows]);
  const selectedEntityTechCandidates = useMemo(() => {
    if (!selectedEntity) return [];

    const entityId = entityIdFor(selectedEntity);
    const linkedDoraIds = new Set(selectedEntity.raw_snippets?.dora?.license_row_ids || []);
    const selectedEntityShop = selectedEntity.shop_license ? shopByLicenseId.get(selectedEntity.shop_license) || null : null;
    const selectedEntityEvidenceAddress = formatAddressKey(selectedEntity.raw_snippets?.dora?.address_key);
    const sameShopPeers = selectedEntity.shop_license
      ? (peerEntitiesByShop.get(selectedEntity.shop_license) || []).filter((row) => entityIdFor(row) !== entityId)
      : [];
    const candidates = techAssociations
      .filter((tech) => {
        if (selectedEntity.shop_license && tech.shop_license_id === selectedEntity.shop_license) return true;
        if (linkedDoraIds.has(tech.tech_row_id)) return true;
        return false;
      })
      .map((tech) => {
        const techId = tech.tech_row_id || tech.tech_license_id;
        const review = salonTechReviewState[techReviewKey(entityId, techId)];
        const evidenceTags: string[] = [];
        let score = 0;

        if (selectedEntity.shop_license && tech.shop_license_id === selectedEntity.shop_license) {
          score += 3;
          evidenceTags.push("shop-linked");
        }
        if (linkedDoraIds.has(tech.tech_row_id)) {
          score += 4;
          evidenceTags.push("matched evidence");
        }

        const overlap = tokenOverlap(selectedEntity.name_display, tech.tech_name);
        if (overlap > 0) {
          score += 3;
          evidenceTags.push("same-name match");
        }

        if (tech.distance_to_shop <= 0.05) {
          score += 4;
          evidenceTags.push("same building");
        } else if (tech.distance_to_shop <= 0.2) {
          score += 2;
          evidenceTags.push("same complex");
        } else {
          score += 1;
          evidenceTags.push("nearby");
        }

        const categoryScore = categoryCompatibility(selectedEntity.operational_category, tech.tech_category);
        if (categoryScore > 0) {
          score += categoryScore;
          evidenceTags.push("category aligned");
        }

        if ((selectedEntity.zip || "") && selectedEntity.zip === tech.zip) {
          score += 1;
          evidenceTags.push("same zip");
        }

        if (tech.association_confidence === "strong") {
          score += 2;
          evidenceTags.push("address exact");
        } else if (tech.association_confidence === "likely") {
          score += 1;
          evidenceTags.push("address near");
        } else {
          evidenceTags.push("address broad");
        }

        const competingSalon = sameShopPeers
          .map((peer) => ({
            peer,
            overlap: tokenOverlap(peer.name_display, tech.tech_name),
            categoryScore: categoryCompatibility(peer.operational_category, tech.tech_category),
            peerScore: getEffectiveScore(peer),
          }))
          .filter((item) => item.overlap > overlap || item.categoryScore > categoryScore)
          .sort((a, b) => b.peerScore - a.peerScore)[0];

        if (competingSalon && competingSalon.peerScore >= getEffectiveScore(selectedEntity)) {
          score -= 3;
          evidenceTags.push("competing nearby salon");
        }

        const computedStatus =
          linkedDoraIds.has(tech.tech_row_id) && overlap > 0 && tech.distance_to_shop <= 0.05
            ? "confirmed"
            : score >= 8
              ? "likely"
              : competingSalon
                ? "conflicting"
                : score >= 4
                  ? "nearby"
                  : "conflicting";
        const currentStatus =
          review?.review_status === "confirmed"
            ? "confirmed"
            : review?.review_status === "rejected"
              ? "rejected"
              : review?.review_status === "watch"
                ? "conflicting"
                : computedStatus;

        const techAddress = formatAddressKey(tech.address_key);
        return {
          ...tech,
          tech_id: techId,
          entity_id: entityId,
          current_status: currentStatus as "confirmed" | "likely" | "nearby" | "conflicting" | "rejected" | "watch" | "unreviewed",
          review,
          association_score: score,
          evidence_tags: evidenceTags,
          competing_salon_name: competingSalon?.peer.name_display || null,
          evidence_summary: evidenceTags.join(" · "),
          addresses: {
            salon_entity: selectedEntityEvidenceAddress || buildShopAddress(selectedEntityShop),
            shop_registration: buildShopAddress(shopByLicenseId.get(tech.shop_license_id) || null),
            matched_evidence: selectedEntityEvidenceAddress,
            tech_license: techAddress,
          },
        };
      })
      .sort((a, b) => {
        const rank = (status: typeof a.current_status) =>
          status === "confirmed"
            ? 6
            : status === "likely"
              ? 5
              : status === "nearby"
                ? 4
                : status === "conflicting"
                  ? 3
                  : status === "watch"
                    ? 2
                    : status === "rejected"
                      ? 1
                      : 0;
        if (rank(b.current_status) !== rank(a.current_status)) return rank(b.current_status) - rank(a.current_status);
        if ((b.association_score || 0) !== (a.association_score || 0)) return (b.association_score || 0) - (a.association_score || 0);
        return a.distance_to_shop - b.distance_to_shop;
      });

    return Array.from(new Map(candidates.map((candidate) => [candidate.tech_id, candidate] as const)).values());
  }, [openEntityId, peerEntitiesByShop, rows, salonTechReviewState, selectedEntity, shopByLicenseId, techAssociations]);

  useEffect(() => {
    if (!openEntityId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenEntityId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openEntityId]);

  async function updateReviewStatus(liveUnitId: string, reviewStatus: ReviewStatus) {
    setSavingLiveUnitId(liveUnitId);
    setSaveError(null);
    try {
      const response = await fetch("/api/admin/live-units/review-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          live_unit_id: liveUnitId,
          review_status: reviewStatus,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !payload?.decision) {
        throw new Error(payload?.error || "Failed to save review status");
      }
      setReviewState((current) => ({
        ...current,
        [liveUnitId]: payload.decision as ReviewDecision,
      }));
    } catch (error: any) {
      setSaveError(error?.message || "Failed to save review status");
    } finally {
      setSavingLiveUnitId(null);
    }
  }

  async function applyReviewAction(ids: string[], action: BulkActionKind, scopeLabel: string) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (!uniqueIds.length) return;

    setSavingBulkAction(`${action}:${scopeLabel}`);
    setSaveError(null);
    try {
      const response = await fetch("/api/admin/live-units/review-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "clear"
            ? {
                live_unit_ids: uniqueIds,
                clear: true,
              }
            : {
                live_unit_ids: uniqueIds,
                review_status: action,
              }
        ),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !payload?.reviewState?.decisions) {
        throw new Error(payload?.error || "Failed to save bulk review action");
      }
      setReviewState(payload.reviewState.decisions as Record<string, ReviewDecision>);
      if (scopeLabel === "selected") {
        setSelectedIds((current) => current.filter((id) => !uniqueIds.includes(id)));
      }
    } catch (error: any) {
      setSaveError(error?.message || "Failed to save bulk review action");
    } finally {
      setSavingBulkAction(null);
    }
  }

  async function updateSalonTechReview(
    entityId: string,
    techId: string,
    action: "confirmed" | "rejected" | "watch" | "clear"
  ) {
    const key = techReviewKey(entityId, techId);
    setSavingTechActionKey(key);
    setSaveError(null);
    try {
      const response = await fetch("/api/admin/live-units/salon-tech-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "clear"
            ? {
                entity_id: entityId,
                tech_id: techId,
                clear: true,
              }
            : {
                entity_id: entityId,
                tech_id: techId,
                review_status: action,
              }
        ),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !payload?.reviewState?.links) {
        throw new Error(payload?.error || "Failed to save tech review");
      }
      setSalonTechReviewState(payload.reviewState.links as Record<string, SalonTechLinkReviewDecision>);
    } catch (error: any) {
      setSaveError(error?.message || "Failed to save tech review");
    } finally {
      setSavingTechActionKey(null);
    }
  }

  function toggleRowSelection(liveUnitId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) return Array.from(new Set([...current, liveUnitId]));
      return current.filter((id) => id !== liveUnitId);
    });
  }

  function toggleVisibleSelection(checked: boolean) {
    setSelectedIds((current) => {
      if (checked) return Array.from(new Set([...current, ...visibleIds]));
      return current.filter((id) => !visibleIds.includes(id));
    });
  }

  function toggleColumnSort(column: SortKey) {
    if (!COLUMN_SORT_KEYS.has(column)) return;
    setActivePreset(null);
    if (sortKey === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(column);
      setSortDir(defaultSortDirForKey(column));
    }
  }

  function applyPreset(preset: PresetId) {
    setActivePreset(preset);
    setConfidence("all");
    setSignalMix("all");
    setCategory("all");
    setZone("all");
    setCity("all");
    setZipQuery("");
    setScoreBand("all");
    setReviewFilter("all");
    setSubtypeFilter("all");
    setTuningFilter("all");
    setEntryAngleFilter("any");
    setServiceScopeFilter("any");
    setSortKey("tuned_score");
    setSortDir("desc");

    if (preset === "unreviewed_likely") {
      setConfidence("likely");
      setReviewFilter("unreviewed");
      return;
    }
    if (preset === "candidate_review") {
      setConfidence("candidate_review");
      return;
    }
    if (preset === "ambiguous") {
      setConfidence("ambiguous");
      return;
    }
    if (preset === "changed_by_feedback") {
      setTuningFilter("changed");
      return;
    }
    if (preset === "high_score_storefront") {
      setScoreBand("70-84");
      setSubtypeFilter("storefront");
      return;
    }
    if (preset === "suite_related") {
      setSubtypeFilter("suite");
      return;
    }
  }

  const tableColSpan = liveUnitsMode === "work" ? 13 : 11;

  return (
    <>
      <LiveUnitsShell
        title="Live Units"
        subtitle={
          liveUnitsMode === "work"
            ? "Operator queue — nail-led targets (incl. mixed-service w/ nail signals) by zone, score, and review. Switch to Review Mode to tune filters."
            : "Review queue for combined Google, DORA, and online identity signals."
        }
        headerActions={
          <WorkModeToggle
            mode={liveUnitsMode}
            onChange={(next) => {
              setLiveUnitsMode(next);
            }}
          />
        }
        workModeSlot={
          liveUnitsMode === "work" ? (
            <WorkModePanel
              summary={workSummary}
              activePresetId={workPresetId}
              onSelectPreset={(id) => setWorkPresetId(id)}
              usePresetOnly={usePresetOnly}
              onUsePresetOnlyChange={setUsePresetOnly}
            />
          ) : null
        }
        collapseFilters={liveUnitsMode === "work"}
        badges={
          <>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                source === "shop_context"
                  ? "bg-violet-100 text-violet-700"
                  : source === "tuned"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-700"
              }`}
            >
              {source === "shop_context"
                ? "Using shop-context artifact"
                : source === "tuned"
                  ? "Using tuned artifact"
                  : "Using base artifact fallback"}
            </span>
            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Default sort: highest tuned score
            </span>
          </>
        }
        metrics={[
          { label: "Total Live Units", value: counts.total },
          { label: "Reviewed", value: reviewCounts.reviewed, tone: "success" },
          { label: "Unreviewed", value: reviewCounts.unreviewed, tone: "muted" },
          { label: "Approved", value: reviewCounts.approved, tone: "success" },
          { label: "Candidate Review", value: counts.candidate_review, tone: "warning" },
          { label: "Ambiguous", value: counts.ambiguous, tone: "danger" },
          { label: "Watch", value: reviewCounts.watch },
          { label: "Needs Research", value: reviewCounts.needs_research },
          { label: "Boosted", value: counts.boosted },
          { label: "Downgraded", value: counts.downgraded },
        ]}
        quickViews={
          <>
            {PRESETS.map((preset) => (
              <PillButton
                key={preset.id}
                active={activePreset === preset.id}
                onClick={() => applyPreset(preset.id)}
              >
                {preset.label}
              </PillButton>
            ))}
          </>
        }
        bulkActions={
          <>
            {visibleIds.length ? (
              <>
                <ActionButton tone="success" onClick={() => void applyReviewAction(visibleIds, "approved", "visible")}>
                  Approve visible
                </ActionButton>
                <ActionButton onClick={() => void applyReviewAction(visibleIds, "watch", "visible")}>
                  Watch visible
                </ActionButton>
                <ActionButton tone="warning" onClick={() => void applyReviewAction(visibleIds, "needs_research", "visible")}>
                  Needs research visible
                </ActionButton>
                <ActionButton tone="danger" onClick={() => void applyReviewAction(visibleIds, "clear", "visible")}>
                  Clear visible
                </ActionButton>
              </>
            ) : (
              <span className="text-sm text-slate-500">Visible-row actions appear when results are loaded.</span>
            )}
          </>
        }
        primaryFilters={
          <FilterGrid cols="3">
            <FilterField label="Confidence" width="md">
              <select
                value={confidence}
                onChange={(event) => {
                  setActivePreset(null);
                  setConfidence(event.target.value as "all" | Confidence);
                }}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[13px] outline-none ring-0"
              >
                {CONFIDENCE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All confidence" : option}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Review Status" width="md">
              <select
                value={reviewFilter}
                onChange={(event) => {
                  setActivePreset(null);
                  setReviewFilter(event.target.value as ReviewFilter);
                }}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[13px] outline-none ring-0"
              >
                {REVIEW_FILTER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All review states" : formatReviewLabel(option)}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Tuning State" width="md">
              <select
                value={tuningFilter}
                onChange={(event) => {
                  setActivePreset(null);
                  setTuningFilter(event.target.value as TuningFilter);
                }}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[13px] outline-none ring-0"
              >
                {TUNING_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FilterField>
          </FilterGrid>
        }
        categoryFilters={
          <FilterGrid cols="2">
            <FilterField label="Signal Mix" width="md">
              <select
                value={signalMix}
                onChange={(event) => {
                  setActivePreset(null);
                  setSignalMix(event.target.value);
                }}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[13px]"
              >
                {signalMixOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All signal mixes" : formatSignalMix(option)}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Category (legacy)" width="md">
              <select
                value={category}
                onChange={(event) => {
                  setActivePreset(null);
                  setCategory(event.target.value);
                }}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[13px]"
              >
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All categories" : option}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Entry angle" width="md">
              <select
                value={entryAngleFilter}
                onChange={(event) => {
                  setActivePreset(null);
                  setEntryAngleFilter(event.target.value as EntryAngleFilter);
                }}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[13px]"
                title="Filter by derived service signal (from name, category, signals)"
              >
                <option value="any">Any entry angle</option>
                <option value="nails">Nails</option>
                <option value="hair">Hair</option>
                <option value="esthetics">Esthetics</option>
                <option value="spa">Spa</option>
              </select>
            </FilterField>

            <FilterField label="Service scope" width="md">
              <select
                value={serviceScopeFilter}
                onChange={(event) => {
                  setActivePreset(null);
                  setServiceScopeFilter(event.target.value as ServiceScopeFilter);
                }}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[13px]"
              >
                <option value="any">Any</option>
                <option value="single">Single-service only</option>
                <option value="multi">Multi-service only</option>
              </select>
            </FilterField>

            <FilterField label="Subtype" width="full">
              <select
                value={subtypeFilter}
                onChange={(event) => {
                  setActivePreset(null);
                  setSubtypeFilter(event.target.value as SubtypeFilter);
                }}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[13px]"
              >
                {SUBTYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FilterField>
          </FilterGrid>
        }
        geographyFilters={
          <FilterGrid cols="2">
            <FilterField label="Zone" width="md">
              <select
                value={zone}
                onChange={(event) => {
                  setActivePreset(null);
                  setZone(event.target.value);
                }}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[13px]"
              >
                {zoneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="City" width="md">
              <select
                value={city}
                onChange={(event) => {
                  setActivePreset(null);
                  setCity(event.target.value);
                }}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[13px]"
              >
                {cityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Zip" width="sm">
              <input
                value={zipQuery}
                onChange={(event) => {
                  setActivePreset(null);
                  setZipQuery(event.target.value);
                }}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[13px]"
                placeholder="80206"
              />
            </FilterField>

            <FilterField label="Score Band" width="md">
              <select
                value={scoreBand}
                onChange={(event) => {
                  setActivePreset(null);
                  setScoreBand(event.target.value as ScoreBand);
                }}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[13px]"
              >
                {SCORE_BANDS.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All score bands" : option}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Sort" width="md">
              <select
                value={sortKey}
                onChange={(event) => {
                  setActivePreset(null);
                  const next = event.target.value as SortKey;
                  setSortKey(next);
                  setSortDir(defaultSortDirForKey(next));
                }}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[13px]"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FilterField>
          </FilterGrid>
        }
        results={
          <div className="space-y-4">
            {selectedIds.length ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium text-slate-800">
                    {selectedIds.length} selected · {selectedVisibleIds.length} visible in current filter
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Clear selection
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["approved", "rejected", "watch", "needs_research", "clear"] as BulkActionKind[]).map((action) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => void applyReviewAction(selectedIds, action, "selected")}
                      disabled={!!savingBulkAction}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                    >
                      {actionLabel(action, "selected")}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {liveUnitsMode === "work" && workResolution?.showResolutionStrip && workPresetId ? (
              <WorkModeResolutionStrip resolution={workResolution} onAction={handleWorkResolutionAction} />
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
              <div className="flex items-center gap-3">
                {liveUnitsMode === "work" && workResolution && workPresetId ? (
                  <span>
                    <span className="font-semibold text-slate-900">{workResolution.resultsHeaderLine}</span>
                    <span className="ml-2 text-slate-500">{workResolution.scopeSubtext}</span>
                  </span>
                ) : (
                  <span>Showing {displayRows.length} rows</span>
                )}
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(node) => {
                      if (node) node.indeterminate = someVisibleSelected;
                    }}
                    onChange={(event) => toggleVisibleSelection(event.target.checked)}
                  />
                  <span>Select all visible rows</span>
                </label>
              </div>
              <div>Selected: {selectedIds.length}</div>
            </div>

            {saveError ? <div className="text-sm text-rose-600">{saveError}</div> : null}

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table
                  className={`${liveUnitsMode === "work" ? "min-w-[1600px]" : "min-w-[1320px]"} table-fixed divide-y divide-neutral-200 text-sm`}
                >
            <thead className="sticky top-0 z-10 bg-neutral-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(node) => {
                      if (node) node.indeterminate = someVisibleSelected;
                    }}
                    onChange={(event) => toggleVisibleSelection(event.target.checked)}
                    aria-label="Select all visible rows"
                  />
                </th>
                <th
                  className="px-3 py-2.5 whitespace-nowrap"
                  aria-sort={sortKey === "name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggleColumnSort("name")}
                    className="inline-flex items-center gap-1 text-left font-semibold uppercase tracking-wide text-neutral-500 transition hover:text-neutral-800"
                    title="Sort by name (click to reverse)"
                  >
                    Name
                    {sortKey === "name" ? (
                      <span className="font-normal normal-case" aria-hidden>
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    ) : null}
                  </button>
                </th>
                {liveUnitsMode === "work" ? (
                  <>
                    <th className="px-3 py-2.5 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Priority
                    </th>
                    <th className="px-3 py-2.5 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Next
                    </th>
                  </>
                ) : null}
                <th
                  className="px-3 py-2.5 whitespace-nowrap"
                  aria-sort={sortKey === "category" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggleColumnSort("category")}
                    className="inline-flex items-center gap-1 text-left font-semibold uppercase tracking-wide text-neutral-500 transition hover:text-neutral-800"
                    title="Sort by category (click to reverse)"
                  >
                    Category
                    {sortKey === "category" ? (
                      <span className="font-normal normal-case" aria-hidden>
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    ) : null}
                  </button>
                </th>
                <th
                  className="px-3 py-2.5 whitespace-nowrap"
                  aria-sort={sortKey === "zone" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggleColumnSort("zone")}
                    className="inline-flex items-center gap-1 text-left font-semibold uppercase tracking-wide text-neutral-500 transition hover:text-neutral-800"
                    title="Sort by zone (click to reverse)"
                  >
                    Zone
                    {sortKey === "zone" ? (
                      <span className="font-normal normal-case" aria-hidden>
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    ) : null}
                  </button>
                </th>
                <th
                  className="px-3 py-2.5 whitespace-nowrap"
                  aria-sort={sortKey === "city" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggleColumnSort("city")}
                    className="inline-flex items-center gap-1 text-left font-semibold uppercase tracking-wide text-neutral-500 transition hover:text-neutral-800"
                    title="Sort by city then zip (click to reverse)"
                  >
                    City / Zip
                    {sortKey === "city" ? (
                      <span className="font-normal normal-case" aria-hidden>
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    ) : null}
                  </button>
                </th>
                <th
                  className="px-3 py-2.5 whitespace-nowrap"
                  aria-sort={sortKey === "nearby_shop_license" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggleColumnSort("nearby_shop_license")}
                    className="inline-flex items-center gap-1 text-left font-semibold uppercase tracking-wide text-neutral-500 transition hover:text-neutral-800"
                    title="Sort by nearby shop license name (click to reverse)"
                  >
                    Nearby Shop License
                    {sortKey === "nearby_shop_license" ? (
                      <span className="font-normal normal-case" aria-hidden>
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    ) : null}
                  </button>
                </th>
                <th
                  className="px-3 py-2.5 whitespace-nowrap"
                  aria-sort={sortKey === "nearby_techs" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggleColumnSort("nearby_techs")}
                    className="inline-flex items-center gap-1 text-left font-semibold uppercase tracking-wide text-neutral-500 transition hover:text-neutral-800"
                    title="Sort by nearby tech count (click to reverse)"
                  >
                    Nearby Techs
                    {sortKey === "nearby_techs" ? (
                      <span className="font-normal normal-case" aria-hidden>
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    ) : null}
                  </button>
                </th>
                <th
                  className="px-3 py-2.5 whitespace-nowrap"
                  aria-sort={sortKey === "tuned_score" ? (sortDir === "desc" ? "descending" : "ascending") : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggleColumnSort("tuned_score")}
                    className="inline-flex items-center gap-1 text-left font-semibold uppercase tracking-wide text-neutral-500 transition hover:text-neutral-800"
                    title="Sort by tuned score (click to reverse)"
                  >
                    Tuned Score
                    {sortKey === "tuned_score" ? (
                      <span className="font-normal normal-case" aria-hidden>
                        {sortDir === "desc" ? "↓" : "↑"}
                      </span>
                    ) : null}
                  </button>
                </th>
                <th
                  className="px-3 py-2.5 whitespace-nowrap"
                  aria-sort={sortKey === "review_status" ? (sortDir === "desc" ? "descending" : "ascending") : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggleColumnSort("review_status")}
                    className="inline-flex items-center gap-1 text-left font-semibold uppercase tracking-wide text-neutral-500 transition hover:text-neutral-800"
                    title="Sort by review status (click to reverse)"
                  >
                    Review Status
                    {sortKey === "review_status" ? (
                      <span className="font-normal normal-case" aria-hidden>
                        {sortDir === "desc" ? "↓" : "↑"}
                      </span>
                    ) : null}
                  </button>
                </th>
                <th className="px-3 py-2.5 whitespace-nowrap">Actions</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {displayRows.map((row) => {
                const rowSig = serviceSignalsByUnitId.get(row.live_unit_id)!;
                const entityDisplay = entityDisplayByUnitId.get(row.live_unit_id)!;
                const currentReview = reviewState[row.live_unit_id];
                const currentStatus = currentReview?.review_status || "unreviewed";
                const isSaving = savingLiveUnitId === row.live_unit_id;
                const signalStatus = signalStatusFor(row, currentReview);
                const workState = deriveWorkStateForRow(row, currentReview?.review_status, workPresetId);
                const googleAddress = googleAddressFor(row) || buildShopAddress(row.shop_license ? shopByLicenseId.get(row.shop_license) || null : null) || "-";
                const linkedDoraIds = row.raw_snippets?.dora?.license_row_ids || [];
                const signalPopoverOpen = openSignalPopoverId === row.live_unit_id;

                return (
                  <Fragment key={row.live_unit_id}>
                    <tr
                      className={`min-h-[3.5rem] transition hover:bg-neutral-50 ${openEntityId === entityIdFor(row) ? "bg-sky-50" : ""}`}
                      onClick={() => setOpenEntityId(entityIdFor(row))}
                    >
                      <td className="px-3 py-2 align-middle">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.live_unit_id)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => toggleRowSelection(row.live_unit_id, event.target.checked)}
                        aria-label={`Select ${row.name_display}`}
                      />
                    </td>
                    <td className="w-[300px] px-3 py-2 align-middle font-medium text-neutral-900">
                      <div className="relative flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenSignalPopoverId((current) => (current === row.live_unit_id ? null : row.live_unit_id));
                          }}
                          className={`h-3 w-3 shrink-0 rounded-full ${signalStatus.color}`}
                          aria-label={`Open signal details for ${row.name_display}`}
                          title={signalStatus.label}
                        />
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenEntityId(entityIdFor(row));
                          }}
                          className="block min-w-0 max-w-[140px] flex-1 truncate text-left text-sm transition hover:text-sky-700 sm:max-w-[180px]"
                          title={row.name_display}
                        >
                          {row.name_display}
                        </button>
                        <EntityKindBadge label={entityDisplay.liveLabel} />
                        <span className="shrink-0 text-xs font-semibold text-neutral-500">
                          DORA {renderDoraTierDots(doraEvidenceTier(row))}
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenSignalPopoverId((current) => (current === row.live_unit_id ? null : row.live_unit_id));
                          }}
                          className="shrink-0 rounded-full border border-neutral-300 px-1.5 py-0.5 text-[11px] font-semibold text-neutral-600 transition hover:border-neutral-500"
                          aria-label={`Open signal details for ${row.name_display}`}
                        >
                          ?
                        </button>
                        {signalPopoverOpen ? (
                          <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-xl border border-neutral-200 bg-white p-3 shadow-xl">
                            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Signal Details</div>
                            <div className="mt-2 space-y-1 text-sm text-neutral-700">
                              <div className="text-xs font-semibold text-neutral-600">{entityDisplay.operatorSummary}</div>
                              <div>
                                Entity: {entityDisplay.entityKind.replaceAll("_", " ")} · Live posture: {entityDisplay.liveLabel}
                              </div>
                              <div>
                                Service signals:{" "}
                                {rowSig.serviceSignals.length
                                  ? rowSig.serviceSignals.map((s) => serviceSignalLabel(s)).join(" · ")
                                  : "None detected"}
                                {rowSig.isMultiService ? " (multi-service)" : ""}
                              </div>
                              <div>Signal mix: {formatSignalMix(row.signal_mix)}</div>
                              <div>Tuned score: {getEffectiveScore(row)}</div>
                              <div>Original score: {row.entity_score}</div>
                              <div>Shop license ID: {row.shop_license || "none"}</div>
                              <div>Linked DORA licenses: {linkedDoraIds.length ? linkedDoraIds.join(", ") : "none"}</div>
                              <div>Match evidence: {row.explanation}</div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <p className="mt-1 max-w-[288px] pl-5 text-[11px] leading-snug text-neutral-600 line-clamp-2">
                        {entityDisplay.operatorSummary}
                      </p>
                      <div className="mt-1 flex max-w-[288px] flex-wrap items-center gap-1 pl-5">
                        <MultiServiceBadge isMultiService={rowSig.isMultiService} />
                        <ServiceSignalChips signals={rowSig.serviceSignals} />
                        <RelationshipHintBadge hint={entityDisplay.relationshipHint} />
                        <EntryOptionChips options={entityDisplay.entryOptions} />
                      </div>
                    </td>
                    {liveUnitsMode === "work" ? (
                      <>
                        <td className="px-2 py-2 align-middle whitespace-nowrap">
                          <WorkPriorityBadge priority={workState.priority} />
                        </td>
                        <td className="px-2 py-2 align-middle whitespace-nowrap">
                          <WorkNextActionBadge action={workState.nextAction} />
                        </td>
                      </>
                    ) : null}
                    <td className="px-3 py-2 align-middle text-neutral-700 whitespace-nowrap">{row.operational_category}</td>
                    <td className="w-[120px] px-3 py-2 align-middle text-neutral-700 whitespace-nowrap">{getZoneName(row)}</td>
                    <td className="w-[130px] px-3 py-2 align-middle text-neutral-700 whitespace-nowrap">
                      {(row.city || "-") + (row.zip ? ` ${row.zip}` : "")}
                    </td>
                    <td className="w-[180px] px-3 py-2 align-middle text-neutral-700">
                      {row.shop_license_name ? (
                        <div className="truncate font-medium text-neutral-900" title={`${row.shop_license_name}${row.shop_license ? ` (${row.shop_license})` : ""}`}>
                          {row.shop_license_name}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-2 align-middle text-neutral-700 whitespace-nowrap">{row.tech_count_nearby ?? 0}</td>
                    <td className="px-3 py-2 align-middle whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${scoreBadgeClass(getEffectiveScore(row))}`}>
                          {typeof row.tuned_entity_score === "number" ? row.tuned_entity_score : row.entity_score}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle whitespace-nowrap">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${reviewBadgeClass(currentStatus)}`}>
                        {formatReviewLabel(currentStatus)}
                      </span>
                    </td>
                    <td className="w-[170px] px-3 py-2 align-middle">
                      <div className="flex min-w-[180px] items-center gap-1.5">
                        <select
                          value={currentReview?.review_status || ""}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            event.stopPropagation();
                            const nextStatus = event.target.value as ReviewStatus | "";
                            if (nextStatus) {
                              void updateReviewStatus(row.live_unit_id, nextStatus);
                            }
                          }}
                          disabled={isSaving}
                          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 outline-none transition focus:border-neutral-500 disabled:cursor-wait disabled:opacity-60"
                          aria-label={`Review action for ${row.name_display}`}
                        >
                          <option value="">Set review</option>
                          {REVIEW_ACTIONS.map((status) => (
                            <option key={status} value={status}>
                              {formatReviewLabel(status)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void applyReviewAction([row.live_unit_id], "clear", "row");
                          }}
                          disabled={!!savingBulkAction}
                          className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700 transition hover:border-neutral-500 disabled:cursor-wait disabled:opacity-60"
                        >
                          Clear
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setExpandedRowId((current) => (current === row.live_unit_id ? null : row.live_unit_id));
                        }}
                        className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 transition hover:border-neutral-500"
                      >
                        {expandedRowId === row.live_unit_id ? "Hide" : "Details"}
                      </button>
                      </td>
                    </tr>
                    {expandedRowId === row.live_unit_id ? (
                      <tr className="bg-neutral-50/60">
                        <td colSpan={tableColSpan} className="px-3 py-3">
                          <div className="grid gap-2 lg:grid-cols-4">
                            <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Explanation</div>
                              <div className="mt-1 text-sm text-neutral-700">{row.explanation}</div>
                            </div>
                            <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Signal Details</div>
                              <div className="mt-1 text-sm text-neutral-700">{formatSignalMix(row.signal_mix)}</div>
                              <div className="mt-1 text-xs text-neutral-500">
                                Original {row.entity_score} {"->"} Tuned {getEffectiveScore(row)}
                              </div>
                            </div>
                            <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Address</div>
                              <div className="mt-1 text-sm text-neutral-700">{googleAddress}</div>
                              {typeof row.shop_distance === "number" ? (
                                <div className="mt-1 text-xs text-neutral-500">
                                  Shop distance {row.shop_distance.toFixed(2)} mi
                                  {row.association_confidence ? ` · ${row.association_confidence}` : ""}
                                </div>
                              ) : null}
                            </div>
                            <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Feedback</div>
                              <div className="mt-1 text-sm text-neutral-700">
                                {row.feedback_tuning?.explanation || "No feedback note"}
                              </div>
                              {currentReview?.updated_at ? (
                                <div className="mt-1 text-xs text-neutral-500">
                                  Updated {new Date(currentReview.updated_at).toLocaleString()}
                                  {currentReview.updated_by ? ` by ${currentReview.updated_by}` : ""}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="px-4 py-8 text-center text-sm text-neutral-500">
                    {liveUnitsMode === "work"
                      ? "No rows match this work preset on top of your current filters. Try another preset or switch to Review Mode."
                      : "No live units match the current review filters."}
                  </td>
                </tr>
              ) : null}
            </tbody>
                </table>
              </div>
            </div>
          </div>
        }
      />

      {selectedEntity ? (
        <>
          <button
            type="button"
            aria-label="Close salon detail panel"
            onClick={() => setOpenEntityId(null)}
            className="fixed inset-0 z-40 bg-neutral-950/30"
          />
          <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-2xl overflow-y-auto border-l border-neutral-200 bg-white shadow-2xl">
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-neutral-200 bg-white px-6 py-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Salon Detail</div>
                <h2 className="mt-1 text-lg font-semibold text-neutral-900">{selectedEntity.name_display}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
                  <span className="inline-flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${selectedEntitySignal?.color || "bg-yellow-400"}`} />
                    <span className="font-semibold">{selectedEntitySignal?.label || "Review"}</span>
                  </span>
                  <span className="font-semibold text-neutral-700">DORA {renderDoraTierDots(doraEvidenceTier(selectedEntity))}</span>
                  <span className="truncate">{googleAddressFor(selectedEntity) || "Address unavailable"}</span>
                  <span>{getZoneName(selectedEntity)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenEntityId(null)}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-sm font-semibold text-neutral-700 transition hover:border-neutral-500"
              >
                Close
              </button>
            </div>

            <div className="space-y-6 px-6 py-5">
              <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Category</div>
                    <div className="mt-1 text-sm text-neutral-900">{selectedEntity.operational_category}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Subtype</div>
                    <div className="mt-1 text-sm text-neutral-900">{selectedEntity.subtype || "unknown"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">City / Zip</div>
                    <div className="mt-1 text-sm text-neutral-900">
                      {selectedEntity.city || "-"} / {selectedEntity.zip || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Zone</div>
                    <div className="mt-1 text-sm text-neutral-900">
                      {getZoneId(selectedEntity)} / {getZoneName(selectedEntity)}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Entity Explanation</div>
                    <div className="mt-1 text-sm text-neutral-700">{selectedEntity.explanation}</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex rounded-full bg-white px-2.5 py-1 font-semibold text-neutral-700">
                    Google linked {linkedGoogleCount(selectedEntity)}
                  </span>
                  <span className="inline-flex rounded-full bg-white px-2.5 py-1 font-semibold text-neutral-700">
                    DORA linked {linkedDoraCount(selectedEntity)}
                  </span>
                  <span className="inline-flex rounded-full bg-white px-2.5 py-1 font-semibold text-neutral-700">
                    Shop anchor {selectedEntity.shop_license ? "yes" : "no"}
                  </span>
                  <span className="inline-flex rounded-full bg-white px-2.5 py-1 font-semibold text-neutral-700">
                    Duplicates collapsed {duplicateCountCollapsed(selectedEntity)}
                  </span>
                  <span className="inline-flex rounded-full bg-white px-2.5 py-1 font-semibold text-neutral-700">
                    {formatSignalMix(selectedEntity.signal_mix)}
                  </span>
                </div>
              </section>

              <section className="rounded-2xl border border-neutral-200 bg-white p-4">
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-neutral-900">Address Evidence</summary>
                  <div className="mt-3 space-y-2 text-sm">
                    {selectedEntityAddresses.length ? (
                      selectedEntityAddresses.map((item) => (
                        <div key={item.label} className="rounded-xl bg-neutral-50 px-3 py-2">
                          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{item.label}</div>
                          <div className="mt-1 text-neutral-900">{item.value}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-neutral-600">No address evidence available.</div>
                    )}
                  </div>
                </details>
              </section>

              <section className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="text-sm font-semibold text-neutral-900">Shop Anchor</div>
                {selectedEntity.shop_license ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Shop Name</div>
                      <div className="mt-1 text-neutral-900">
                        {selectedEntityShop?.shop_name || selectedEntity.shop_license_name || "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">License Id</div>
                      <div className="mt-1 text-neutral-900">{selectedEntity.shop_license}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Address</div>
                      <div className="mt-1 text-neutral-900">{selectedEntityShop?.address || "Address unavailable"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">City / Zip</div>
                      <div className="mt-1 text-neutral-900">{selectedEntityShop?.city || "-"} / {selectedEntityShop?.zip || "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Distance To Entity</div>
                      <div className="mt-1 text-neutral-900">
                        {typeof selectedEntity.shop_distance === "number" ? `${selectedEntity.shop_distance.toFixed(2)} mi` : "n/a"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-neutral-600">No DORA shop anchor linked.</div>
                )}
              </section>

              {[
                {
                  title: "Confirmed Techs",
                  rows: selectedEntityTechCandidates.filter((tech) => tech.current_status === "confirmed"),
                  collapsible: false,
                },
                {
                  title: "Likely Techs",
                  rows: selectedEntityTechCandidates.filter((tech) => tech.current_status === "likely"),
                  collapsible: false,
                },
                {
                  title: "Nearby Techs",
                  rows: selectedEntityTechCandidates.filter((tech) => ["nearby", "unreviewed"].includes(tech.current_status)),
                  collapsible: true,
                },
                {
                  title: "Conflicting Techs",
                  rows: selectedEntityTechCandidates.filter((tech) => tech.current_status === "conflicting"),
                  collapsible: true,
                },
                {
                  title: "Rejected Techs",
                  rows: selectedEntityTechCandidates.filter((tech) => tech.current_status === "rejected"),
                  collapsible: true,
                },
              ].map((section) => (
                <section key={section.title} className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-neutral-900">{section.title}</div>
                    <div className="text-xs text-neutral-500">{section.rows.length} rows</div>
                  </div>
                  {section.rows.length ? (
                    section.collapsible ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Show {section.title.toLowerCase()}
                        </summary>
                        <div className="mt-2 space-y-2">
                          {section.rows.map((tech) => (
                            <div key={tech.tech_id} className="rounded-xl border border-neutral-200 p-2.5">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <div className="font-medium text-neutral-900">{tech.tech_name}</div>
                                  <div className="mt-0.5 text-sm text-neutral-600">
                                    {tech.license_type || "Profession unavailable"} · {tech.tech_category}
                                  </div>
                                  <div className="mt-0.5 text-sm text-neutral-600">
                                    {tech.city || "-"} / {tech.zip || "-"}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs">
                                  <span className={`inline-flex rounded-full px-2.5 py-1 font-semibold ${techAssociationBadgeClass(tech.current_status)}`}>
                                    {formatReviewLabel(tech.current_status)}
                                  </span>
                                  <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-1 font-semibold text-neutral-700">
                                    {tech.distance_to_shop.toFixed(3)} mi
                                  </span>
                                  <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-1 font-semibold text-neutral-700">
                                    score {tech.association_score}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                                {tech.evidence_tags.map((tag: string) => (
                                  <span key={tag} className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 font-semibold text-neutral-700">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                              {tech.competing_salon_name ? (
                                <div className="mt-1 text-xs text-amber-700">Competing nearby salon: {tech.competing_salon_name}</div>
                              ) : null}
                              <div className="mt-1.5 space-y-0.5 text-xs text-neutral-500">
                                {tech.addresses.salon_entity ? <div>Salon/entity: {tech.addresses.salon_entity}</div> : null}
                                {tech.addresses.shop_registration ? <div>Shop registration: {tech.addresses.shop_registration}</div> : null}
                                {tech.addresses.matched_evidence ? <div>Matched evidence: {tech.addresses.matched_evidence}</div> : null}
                                {tech.addresses.tech_license ? <div>Tech address: {tech.addresses.tech_license}</div> : null}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {[
                                  { label: "Confirm Link", value: "confirmed" as const },
                                  { label: "Reject Link", value: "rejected" as const },
                                  { label: "Watch", value: "watch" as const },
                                ].map((action) => (
                                  <button
                                    key={action.value}
                                    type="button"
                                    onClick={() => void updateSalonTechReview(tech.entity_id, tech.tech_id, action.value)}
                                    disabled={savingTechActionKey === techReviewKey(tech.entity_id, tech.tech_id)}
                                    className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:border-neutral-500 disabled:cursor-wait disabled:opacity-60"
                                  >
                                    {action.label}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => void updateSalonTechReview(tech.entity_id, tech.tech_id, "clear")}
                                  disabled={savingTechActionKey === techReviewKey(tech.entity_id, tech.tech_id)}
                                  className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:border-neutral-500 disabled:cursor-wait disabled:opacity-60"
                                >
                                  Clear
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {section.rows.map((tech) => (
                          <div key={tech.tech_id} className="rounded-xl border border-neutral-200 p-2.5">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="font-medium text-neutral-900">{tech.tech_name}</div>
                              <div className="mt-0.5 text-sm text-neutral-600">
                                {tech.license_type || "Profession unavailable"} · {tech.tech_category}
                              </div>
                              <div className="mt-0.5 text-sm text-neutral-600">
                                {tech.city || "-"} / {tech.zip || "-"}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className={`inline-flex rounded-full px-2.5 py-1 font-semibold ${techAssociationBadgeClass(tech.current_status)}`}>
                                {formatReviewLabel(tech.current_status)}
                              </span>
                              <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-1 font-semibold text-neutral-700">
                                {tech.distance_to_shop.toFixed(3)} mi
                              </span>
                              <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-1 font-semibold text-neutral-700">
                                score {tech.association_score}
                              </span>
                            </div>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                            {tech.evidence_tags.map((tag: string) => (
                              <span key={tag} className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 font-semibold text-neutral-700">
                                {tag}
                              </span>
                            ))}
                          </div>
                          {tech.competing_salon_name ? (
                            <div className="mt-1 text-xs text-amber-700">Competing nearby salon: {tech.competing_salon_name}</div>
                          ) : null}
                          <div className="mt-1.5 space-y-0.5 text-xs text-neutral-500">
                            {tech.addresses.salon_entity ? <div>Salon/entity: {tech.addresses.salon_entity}</div> : null}
                            {tech.addresses.shop_registration ? <div>Shop registration: {tech.addresses.shop_registration}</div> : null}
                            {tech.addresses.matched_evidence ? <div>Matched evidence: {tech.addresses.matched_evidence}</div> : null}
                            {tech.addresses.tech_license ? <div>Tech address: {tech.addresses.tech_license}</div> : null}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {[
                              { label: "Confirm Link", value: "confirmed" as const },
                              { label: "Reject Link", value: "rejected" as const },
                              { label: "Watch", value: "watch" as const },
                            ].map((action) => (
                              <button
                                key={action.value}
                                type="button"
                                onClick={() => void updateSalonTechReview(tech.entity_id, tech.tech_id, action.value)}
                                disabled={savingTechActionKey === techReviewKey(tech.entity_id, tech.tech_id)}
                                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:border-neutral-500 disabled:cursor-wait disabled:opacity-60"
                              >
                                {action.label}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => void updateSalonTechReview(tech.entity_id, tech.tech_id, "clear")}
                              disabled={savingTechActionKey === techReviewKey(tech.entity_id, tech.tech_id)}
                              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:border-neutral-500 disabled:cursor-wait disabled:opacity-60"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="mt-3 text-sm text-neutral-500">No tech candidates in this section.</div>
                  )}
                </section>
              ))}
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
