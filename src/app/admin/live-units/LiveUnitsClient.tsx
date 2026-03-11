"use client";

import { useMemo, useState } from "react";

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
  | "review_status";
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
  name_display: string;
  operational_category: string;
  subtype?: string;
  confidence: Confidence;
  tuned_confidence?: Confidence;
  signal_mix: string;
  city: string | null;
  zip: string | null;
  entity_score: number;
  tuned_entity_score?: number;
  explanation: string;
  raw_snippets?: {
    google?: {
      zone_id?: string;
      zone_name?: string;
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

type BulkActionKind = ReviewStatus | "clear";

type Props = {
  rows: LiveUnitRow[];
  source: "shop_context" | "tuned" | "base";
  initialReviewState: Record<string, ReviewDecision>;
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
];
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

export default function LiveUnitsClient({ rows, source, initialReviewState }: Props) {
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
  const [sortKey, setSortKey] = useState<SortKey>("tuned_score");
  const [reviewState, setReviewState] = useState<Record<string, ReviewDecision>>(initialReviewState);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [savingLiveUnitId, setSavingLiveUnitId] = useState<string | null>(null);
  const [savingBulkAction, setSavingBulkAction] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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
      .sort((a, b) => {
        if (sortKey === "tuned_score") {
          if (getEffectiveScore(b) !== getEffectiveScore(a)) return getEffectiveScore(b) - getEffectiveScore(a);
        } else if (sortKey === "original_score") {
          if (b.entity_score !== a.entity_score) return b.entity_score - a.entity_score;
        } else if (sortKey === "confidence") {
          if (confidenceRank(getEffectiveConfidence(b)) !== confidenceRank(getEffectiveConfidence(a))) {
            return confidenceRank(getEffectiveConfidence(b)) - confidenceRank(getEffectiveConfidence(a));
          }
        } else if (sortKey === "zone") {
          const zoneCompare = getZoneName(a).localeCompare(getZoneName(b));
          if (zoneCompare !== 0) return zoneCompare;
        } else if (sortKey === "category") {
          const categoryCompare = a.operational_category.localeCompare(b.operational_category);
          if (categoryCompare !== 0) return categoryCompare;
        } else if (sortKey === "city") {
          const cityCompare = (a.city || "").localeCompare(b.city || "");
          if (cityCompare !== 0) return cityCompare;
        } else if (sortKey === "signal_mix") {
          const signalCompare = a.signal_mix.localeCompare(b.signal_mix);
          if (signalCompare !== 0) return signalCompare;
        } else if (sortKey === "review_status") {
          const reviewStatusA = (reviewState[a.live_unit_id]?.review_status || "unreviewed") as ReviewStatus | "unreviewed";
          const reviewStatusB = (reviewState[b.live_unit_id]?.review_status || "unreviewed") as ReviewStatus | "unreviewed";
          if (getReviewStatusRank(reviewStatusB) !== getReviewStatusRank(reviewStatusA)) {
            return getReviewStatusRank(reviewStatusB) - getReviewStatusRank(reviewStatusA);
          }
        }

        return [getZoneName(a), a.operational_category, a.city ?? "", a.zip ?? "", a.name_display].join("|").localeCompare(
          [getZoneName(b), b.operational_category, b.city ?? "", b.zip ?? "", b.name_display].join("|")
        );
      });
  }, [category, city, confidence, reviewFilter, reviewState, rows, scoreBand, signalMix, sortKey, subtypeFilter, tuningFilter, zipQuery, zone]);

  const visibleIds = useMemo(() => filteredRows.map((row) => row.live_unit_id), [filteredRows]);
  const selectedVisibleIds = useMemo(
    () => visibleIds.filter((id) => selectedIds.includes(id)),
    [selectedIds, visibleIds]
  );
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleIds.length === visibleIds.length;
  const someVisibleSelected = selectedVisibleIds.length > 0 && !allVisibleSelected;

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

  function applyPreset(preset: PresetId) {
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
    setSortKey("tuned_score");

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

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Live Units</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Review queue for combined Google, DORA, and online identity signals.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`inline-flex rounded-full px-2.5 py-1 font-semibold ${
              source === "shop_context"
                ? "bg-violet-100 text-violet-800"
                : source === "tuned"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-neutral-100 text-neutral-700"
            }`}
          >
            {source === "shop_context"
              ? "Using shop-context artifact"
              : source === "tuned"
                ? "Using tuned artifact"
                : "Using base artifact fallback"}
          </span>
          <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-1 font-semibold text-neutral-700">
            Default sort: highest tuned score
          </span>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          { label: "Total Live Units", value: counts.total },
          { label: "Approved", value: reviewCounts.approved },
          { label: "Rejected", value: reviewCounts.rejected },
          { label: "Watch", value: reviewCounts.watch },
          { label: "Candidate Review", value: counts.candidate_review },
          { label: "Needs Research", value: reviewCounts.needs_research },
          { label: "Ambiguous", value: counts.ambiguous },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{item.label}</div>
            <div className="mt-1 text-2xl font-semibold text-neutral-900">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          { label: "Reviewed", value: reviewCounts.reviewed },
          { label: "Unreviewed", value: reviewCounts.unreviewed },
          { label: "Reviewed %", value: `${reviewedPercent}%` },
          { label: "Reviewed of Total", value: `${reviewCounts.reviewed}/${rows.length}` },
          { label: "Boosted by Feedback", value: counts.boosted },
          { label: "Downgraded by Feedback", value: counts.downgraded },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{item.label}</div>
            <div className="mt-1 text-2xl font-semibold text-neutral-900">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        {selectedIds.length ? (
          <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-medium text-neutral-800">
                {selectedIds.length} selected · {selectedVisibleIds.length} visible in current filter
              </div>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:border-neutral-500"
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
                  className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-500 disabled:cursor-wait disabled:opacity-60"
                >
                  {actionLabel(action, "selected")}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-b border-neutral-200 pb-4">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-500"
            >
              {preset.label}
            </button>
          ))}
          {visibleIds.length ? (
            <>
              <span className="mx-1 h-6 w-px self-center bg-neutral-200" />
              {BULK_VISIBLE_ACTIONS.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => void applyReviewAction(visibleIds, action, "visible")}
                  disabled={!!savingBulkAction}
                  className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-500 disabled:cursor-wait disabled:opacity-60"
                >
                  {actionLabel(action, "visible")}
                </button>
              ))}
            </>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Confidence</span>
            <select
              value={confidence}
              onChange={(event) => setConfidence(event.target.value as "all" | Confidence)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
            >
              {CONFIDENCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All confidence" : option}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Signal Mix</span>
            <select
              value={signalMix}
              onChange={(event) => setSignalMix(event.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
            >
              {signalMixOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All signal mixes" : formatSignalMix(option)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
            >
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All categories" : option}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Zone</span>
            <select
              value={zone}
              onChange={(event) => setZone(event.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
            >
              {zoneOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Review Status</span>
            <select
              value={reviewFilter}
              onChange={(event) => setReviewFilter(event.target.value as ReviewFilter)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
            >
              {REVIEW_FILTER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All review states" : formatReviewLabel(option)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">City</span>
            <select
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
            >
              {cityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Zip</span>
            <input
              value={zipQuery}
              onChange={(event) => setZipQuery(event.target.value)}
              placeholder="80206"
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-500"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Score Band</span>
            <select
              value={scoreBand}
              onChange={(event) => setScoreBand(event.target.value as ScoreBand)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
            >
              {SCORE_BANDS.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All score bands" : option}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Subtype</span>
            <select
              value={subtypeFilter}
              onChange={(event) => setSubtypeFilter(event.target.value as SubtypeFilter)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
            >
              {SUBTYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Tuning State</span>
            <select
              value={tuningFilter}
              onChange={(event) => setTuningFilter(event.target.value as TuningFilter)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
            >
              {TUNING_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Sort</span>
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 text-sm text-neutral-600">Showing {filteredRows.length} rows</div>
        {visibleIds.length ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
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
            <span>Selected: {selectedIds.length}</span>
          </div>
        ) : null}
        {saveError ? <div className="mt-2 text-sm text-rose-600">{saveError}</div> : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3">
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
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Review Status</th>
                <th className="px-4 py-3">Signal Mix</th>
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Zip</th>
                <th className="px-4 py-3">Nearby Shop License</th>
                <th className="px-4 py-3">Distance</th>
                <th className="px-4 py-3">Nearby Techs</th>
                <th className="px-4 py-3">Original Score</th>
                <th className="px-4 py-3">Tuned Score</th>
                <th className="px-4 py-3">Feedback</th>
                <th className="px-4 py-3">Explanation</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredRows.map((row) => {
                const currentReview = reviewState[row.live_unit_id];
                const currentStatus = currentReview?.review_status || "unreviewed";
                const isSaving = savingLiveUnitId === row.live_unit_id;

                return (
                  <tr key={row.live_unit_id} className="align-top">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.live_unit_id)}
                        onChange={(event) => toggleRowSelection(row.live_unit_id, event.target.checked)}
                        aria-label={`Select ${row.name_display}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-neutral-900">{row.name_display}</td>
                    <td className="px-4 py-3 text-neutral-700">{row.operational_category}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${confidenceBadgeClass(row.confidence)}`}>
                        {getEffectiveConfidence(row)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${reviewBadgeClass(currentStatus)}`}>
                        {formatReviewLabel(currentStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{formatSignalMix(row.signal_mix)}</td>
                    <td className="px-4 py-3 text-neutral-700">{getZoneName(row)}</td>
                    <td className="px-4 py-3 text-neutral-700">{row.city || "-"}</td>
                    <td className="px-4 py-3 text-neutral-700">{row.zip || "-"}</td>
                    <td className="px-4 py-3 text-neutral-700">
                      {row.shop_license_name ? (
                        <div className="space-y-1">
                          <div className="font-medium text-neutral-900">{row.shop_license_name}</div>
                          <div className="text-xs text-neutral-500">{row.shop_license}</div>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {typeof row.shop_distance === "number" ? (
                        <div className="space-y-1">
                          <div>{row.shop_distance.toFixed(2)} mi</div>
                          {row.association_confidence ? (
                            <span className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
                              {row.association_confidence}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{row.tech_count_nearby ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${scoreBadgeClass(row.entity_score)}`}>
                        {row.entity_score}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${scoreBadgeClass(getEffectiveScore(row))}`}>
                          {typeof row.tuned_entity_score === "number" ? row.tuned_entity_score : row.entity_score}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {hasFeedbackTuning(row) ? (
                          <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${tuningBadgeClass(row)}`}>
                            {tuningLabel(row)}
                          </span>
                        ) : (
                          <span className="inline-flex w-fit rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                            unchanged
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      <div>{row.explanation}</div>
                      {row.feedback_tuning?.explanation ? (
                        <div className="mt-1 text-xs text-neutral-500">{row.feedback_tuning.explanation}</div>
                      ) : null}
                      {currentReview?.updated_at ? (
                        <div className="mt-1 text-xs text-neutral-400">
                          Updated {new Date(currentReview.updated_at).toLocaleString()}
                          {currentReview.updated_by ? ` by ${currentReview.updated_by}` : ""}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-[240px] flex-wrap gap-2">
                        {REVIEW_ACTIONS.map((status) => {
                          const active = currentReview?.review_status === status;
                          return (
                            <button
                              key={status}
                              type="button"
                              onClick={() => void updateReviewStatus(row.live_unit_id, status)}
                              disabled={isSaving}
                              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                                active
                                  ? status === "approved"
                                    ? "border-emerald-700 bg-emerald-700 text-white"
                                    : status === "rejected"
                                      ? "border-rose-700 bg-rose-700 text-white"
                                      : status === "watch"
                                        ? "border-amber-700 bg-amber-700 text-white"
                                        : "border-violet-700 bg-violet-700 text-white"
                                  : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500"
                              } ${isSaving ? "cursor-wait opacity-60" : ""}`}
                            >
                              {status === "approved"
                                ? "Approve"
                                : status === "rejected"
                                  ? "Reject"
                                  : status === "watch"
                                    ? "Watch"
                                    : "Needs Research"}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => void applyReviewAction([row.live_unit_id], "clear", "row")}
                          disabled={!!savingBulkAction}
                          className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:border-neutral-500 disabled:cursor-wait disabled:opacity-60"
                        >
                          Clear
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={17} className="px-4 py-8 text-center text-sm text-neutral-500">
                    No live units match the current review filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
