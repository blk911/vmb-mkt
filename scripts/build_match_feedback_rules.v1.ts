import fs from "node:fs";
import path from "node:path";
import type {
  FeedbackRule,
  FeedbackRulesFile,
  LiveUnitConfidence,
} from "../src/lib/markets/feedbackRules";

type ReviewStatus = "approved" | "rejected" | "watch" | "needs_research";

type LiveUnitRow = {
  live_unit_id: string;
  name_display: string;
  operational_category: string;
  subtype: string;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lon: number | null;
  signal_mix: string;
  entity_score: number;
  confidence: LiveUnitConfidence;
  live_unit: boolean;
  explanation: string;
  raw_snippets?: {
    google?: {
      zone_id?: string;
      zone_name?: string;
    };
  };
};

type LiveUnitsFile = {
  rows?: LiveUnitRow[];
};

type ReviewDecision = {
  live_unit_id: string;
  review_status: ReviewStatus;
  updated_at: string;
  updated_by?: string;
};

type ReviewStateFile = {
  decisions?: Record<string, ReviewDecision>;
};

type ApprovedRow = {
  live_unit_id: string;
  name_display: string;
  operational_category: string;
  subtype: string;
  signal_mix: string;
  confidence: LiveUnitConfidence;
  entity_score: number;
  primary_zone_id: string | null;
  primary_zone_name: string | null;
};

type ApprovedFile = {
  rows?: ApprovedRow[];
};

type FeedbackRow = {
  live_unit_id: string;
  review_status: Exclude<ReviewStatus, "approved">;
  name_display: string;
  operational_category: string;
  subtype: string;
  signal_mix: string;
  confidence: LiveUnitConfidence;
  entity_score: number;
  raw_snippets?: {
    google?: {
      zone_id?: string;
      zone_name?: string;
    };
  };
};

type FeedbackFile = {
  rows?: FeedbackRow[];
};

type TuningAdjustment = {
  rule_id: string;
  label: string;
  score_delta: number;
  review_source: string;
};

type TunedLiveUnitRow = LiveUnitRow & {
  tuned_entity_score: number;
  tuned_confidence: LiveUnitConfidence;
  tuned_live_unit: boolean;
  feedback_tuning: {
    original_entity_score: number;
    original_confidence: LiveUnitConfidence;
    score_delta: number;
    matched_rule_ids: string[];
    adjustments: TuningAdjustment[];
    explanation: string;
  };
};

const ROOT = process.cwd();
const LIVE_UNITS_PATH = path.join(ROOT, "data", "markets", "beauty_live_units.v1.json");
const REVIEW_STATE_PATH = path.join(ROOT, "data", "markets", "beauty_live_units_review_state.v1.json");
const APPROVED_PATH = path.join(ROOT, "data", "markets", "beauty_live_units_approved.v1.json");
const FEEDBACK_PATH = path.join(ROOT, "data", "markets", "beauty_live_units_feedback.v1.json");
const RULES_OUTPUT_PATH = path.join(ROOT, "data", "markets", "beauty_match_feedback_rules.v1.json");
const TUNED_OUTPUT_PATH = path.join(ROOT, "data", "markets", "beauty_live_units_tuned.v1.json");

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function ensureDirForFile(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function scoreBand(score: number) {
  if (score >= 85) return "85-100";
  if (score >= 70) return "70-84";
  if (score >= 55) return "55-69";
  return "0-54";
}

function zoneIdFromFeedback(row: FeedbackRow) {
  return row.raw_snippets?.google?.zone_id || "";
}

function zoneNameFromFeedback(row: FeedbackRow) {
  return row.raw_snippets?.google?.zone_name || "";
}

function confidenceCounts(rows: Array<{ confidence: LiveUnitConfidence }>) {
  return {
    strong: rows.filter((row) => row.confidence === "strong").length,
    likely: rows.filter((row) => row.confidence === "likely").length,
    candidate_review: rows.filter((row) => row.confidence === "candidate_review").length,
    ambiguous: rows.filter((row) => row.confidence === "ambiguous").length,
  };
}

function tunedConfidenceCounts(rows: Array<{ tuned_confidence: LiveUnitConfidence }>) {
  return {
    strong: rows.filter((row) => row.tuned_confidence === "strong").length,
    likely: rows.filter((row) => row.tuned_confidence === "likely").length,
    candidate_review: rows.filter((row) => row.tuned_confidence === "candidate_review").length,
    ambiguous: rows.filter((row) => row.tuned_confidence === "ambiguous").length,
  };
}

function buildFeedbackRules(
  approvedRows: ApprovedRow[],
  feedbackRows: FeedbackRow[],
  reviewState: ReviewStateFile
): FeedbackRulesFile {
  const approvalPatterns = approvedRows.map((row) => ({
    zone_id: row.primary_zone_id,
    zone_name: row.primary_zone_name,
    signal_mix: row.signal_mix,
    operational_category: row.operational_category,
    subtype: row.subtype,
    support_count: 1,
    avg_entity_score: row.entity_score,
  }));

  const cautionPatterns = feedbackRows.map((row) => ({
    review_status: row.review_status,
    zone_id: zoneIdFromFeedback(row) || null,
    zone_name: zoneNameFromFeedback(row) || null,
    signal_mix: row.signal_mix,
    operational_category: row.operational_category,
    subtype: row.subtype,
    score_band: scoreBand(row.entity_score),
    support_count: 1,
    avg_entity_score: row.entity_score,
    confidence: row.confidence,
  }));

  const rules: FeedbackRule[] = [];

  for (const row of approvedRows) {
    if (row.primary_zone_id) {
      rules.push({
        rule_id: `boost_zone_${row.primary_zone_id}_${row.operational_category}_${row.subtype}_${row.signal_mix}`.replace(
          /[^a-zA-Z0-9_]+/g,
          "_"
        ),
        effect: "boost",
        review_source: "approved",
        support_count: 1,
        label: `approved ${row.primary_zone_id} ${row.operational_category} ${row.signal_mix} ${row.subtype} pattern`,
        score_delta: 3,
        match: {
          zone_id: row.primary_zone_id,
          operational_category: row.operational_category,
          signal_mix: row.signal_mix,
          subtype: row.subtype,
          min_entity_score: Math.max(65, row.entity_score - 25),
        },
        rationale: "Approved reviewed unit supports a modest boost for similar same-zone patterns.",
      });
    }

    if (row.entity_score >= 85) {
      rules.push({
        rule_id: `boost_broad_${row.operational_category}_${row.subtype}_${row.signal_mix}`.replace(/[^a-zA-Z0-9_]+/g, "_"),
        effect: "boost",
        review_source: "approved",
        support_count: 1,
        label: `approved ${row.operational_category} ${row.signal_mix} ${row.subtype} pattern`,
        score_delta: 1,
        match: {
          operational_category: row.operational_category,
          signal_mix: row.signal_mix,
          subtype: row.subtype,
          min_entity_score: Math.max(70, row.entity_score - 20),
        },
        rationale: "Broad approved pattern gets only a small boost to avoid overfitting.",
      });
    }
  }

  for (const row of feedbackRows) {
    const zoneId = zoneIdFromFeedback(row);
    const zoneName = zoneNameFromFeedback(row);
    const baseDelta = row.review_status === "rejected" ? -4 : row.review_status === "needs_research" ? -3 : -2;

    rules.push({
      rule_id: `caution_pattern_${row.review_status}_${row.operational_category}_${row.subtype}_${row.signal_mix}`.replace(
        /[^a-zA-Z0-9_]+/g,
        "_"
      ),
      effect: "caution",
      review_source: row.review_status,
      support_count: 1,
      label: `${row.review_status} ${row.operational_category} ${row.signal_mix} ${row.subtype} pattern`,
      score_delta: baseDelta,
      match: {
        operational_category: row.operational_category,
        signal_mix: row.signal_mix,
        subtype: row.subtype,
        min_entity_score: Math.max(0, row.entity_score - 10),
        max_entity_score: Math.min(100, row.entity_score + 10),
      },
      rationale: "Human review flagged this exact pattern as requiring caution.",
    });

    if (zoneId) {
      rules.push({
        rule_id: `caution_zone_${row.review_status}_${zoneId}_${row.operational_category}_${row.subtype}_${row.signal_mix}`.replace(
          /[^a-zA-Z0-9_]+/g,
          "_"
        ),
        effect: "caution",
        review_source: row.review_status,
        support_count: 1,
        label: `${row.review_status} ${zoneId} ${row.operational_category} ${row.signal_mix} ${row.subtype} pattern`,
        score_delta: row.review_status === "rejected" ? -4 : -2,
        match: {
          zone_id: zoneId,
          operational_category: row.operational_category,
          signal_mix: row.signal_mix,
          subtype: row.subtype,
        },
        rationale: `Reviewed caution observed in ${zoneName || zoneId}.`,
      });
    }

    rules.push({
      rule_id: `caution_band_${row.review_status}_${row.operational_category}_${row.signal_mix}_${scoreBand(row.entity_score)}`.replace(
        /[^a-zA-Z0-9_]+/g,
        "_"
      ),
      effect: "caution",
      review_source: row.review_status,
      support_count: 1,
      label: `${row.review_status} ${row.operational_category} ${row.signal_mix} ${scoreBand(row.entity_score)} band`,
      score_delta: -1,
      match: {
        operational_category: row.operational_category,
        signal_mix: row.signal_mix,
        min_entity_score: scoreBand(row.entity_score) === "85-100" ? 85 : scoreBand(row.entity_score) === "70-84" ? 70 : scoreBand(row.entity_score) === "55-69" ? 55 : 0,
        max_entity_score: scoreBand(row.entity_score) === "85-100" ? 100 : scoreBand(row.entity_score) === "70-84" ? 84 : scoreBand(row.entity_score) === "55-69" ? 69 : 54,
      },
      rationale: "Reviewed score band suggests caution for similar evidence quality.",
    });
  }

  const decisions = reviewState.decisions || {};

  return {
    generated_at: new Date().toISOString(),
    input_paths: {
      live_units: LIVE_UNITS_PATH,
      review_state: REVIEW_STATE_PATH,
      approved: APPROVED_PATH,
      feedback: FEEDBACK_PATH,
    },
    summary: {
      approved_count: Object.values(decisions).filter((row) => row.review_status === "approved").length,
      rejected_count: Object.values(decisions).filter((row) => row.review_status === "rejected").length,
      watch_count: Object.values(decisions).filter((row) => row.review_status === "watch").length,
      needs_research_count: Object.values(decisions).filter((row) => row.review_status === "needs_research").length,
    },
    pattern_summaries: {
      approval_patterns: approvalPatterns,
      caution_patterns: cautionPatterns,
    },
    rules: rules.sort((a, b) => a.rule_id.localeCompare(b.rule_id)),
    notes: [
      "Rules are heuristic and deterministic; they only modestly boost or suppress similar reviewed patterns.",
      "Strong direct evidence still dominates; ambiguous rows are never auto-promoted by feedback.",
      "Sparse review coverage means current rules are intentionally narrow.",
    ],
  };
}

async function main() {
  const { applyFeedbackRules } = (await import(
    new URL("../src/lib/markets/feedbackRules.ts", import.meta.url).href
  )) as typeof import("../src/lib/markets/feedbackRules");

  const liveUnitsFile = readJson<LiveUnitsFile>(LIVE_UNITS_PATH);
  const reviewStateFile = readJson<ReviewStateFile>(REVIEW_STATE_PATH);
  const approvedFile = readJson<ApprovedFile>(APPROVED_PATH);
  const feedbackFile = readJson<FeedbackFile>(FEEDBACK_PATH);

  const rulesFile = buildFeedbackRules(
    approvedFile.rows || [],
    feedbackFile.rows || [],
    reviewStateFile
  );

  const baseRows = [...(liveUnitsFile.rows || [])].sort((a, b) => a.live_unit_id.localeCompare(b.live_unit_id));
  const tunedRows: TunedLiveUnitRow[] = baseRows.map((row) => {
    const tuning = applyFeedbackRules(row, rulesFile);
    return {
      ...row,
      tuned_entity_score: tuning.tuned_entity_score,
      tuned_confidence: tuning.tuned_confidence,
      tuned_live_unit: tuning.tuned_confidence === "strong" || tuning.tuned_confidence === "likely",
      feedback_tuning: {
        original_entity_score: row.entity_score,
        original_confidence: row.confidence,
        score_delta: tuning.score_delta,
        matched_rule_ids: tuning.matched_rules.map((rule) => rule.rule_id),
        adjustments: tuning.matched_rules.map((rule) => ({
          rule_id: rule.rule_id,
          label: rule.label,
          score_delta: rule.score_delta,
          review_source: rule.review_source,
        })),
        explanation: tuning.explanation,
      },
    };
  });

  const boostedRows = tunedRows.filter((row) => row.feedback_tuning.score_delta > 0).length;
  const downgradedRows = tunedRows.filter((row) => row.feedback_tuning.score_delta < 0).length;
  const beforeCounts = confidenceCounts(baseRows);
  const afterCounts = tunedConfidenceCounts(tunedRows);

  const tunedOutput = {
    generated_at: new Date().toISOString(),
    input_paths: {
      live_units: LIVE_UNITS_PATH,
      feedback_rules: RULES_OUTPUT_PATH,
    },
    summary: {
      total_tuned_rows: tunedRows.length,
      rows_boosted: boostedRows,
      rows_downgraded: downgradedRows,
      confidence_before: beforeCounts,
      confidence_after: afterCounts,
    },
    rows: tunedRows,
  };

  ensureDirForFile(RULES_OUTPUT_PATH);
  ensureDirForFile(TUNED_OUTPUT_PATH);
  fs.writeFileSync(RULES_OUTPUT_PATH, JSON.stringify(rulesFile, null, 2), "utf8");
  fs.writeFileSync(TUNED_OUTPUT_PATH, JSON.stringify(tunedOutput, null, 2), "utf8");

  console.log(`Total tuned rows: ${tunedRows.length}`);
  console.log(`Rows boosted by approved-like rules: ${boostedRows}`);
  console.log(`Rows downgraded by cautionary rules: ${downgradedRows}`);
  console.log(
    `Confidence before: strong ${beforeCounts.strong}, likely ${beforeCounts.likely}, candidate_review ${beforeCounts.candidate_review}, ambiguous ${beforeCounts.ambiguous}`
  );
  console.log(
    `Confidence after: strong ${afterCounts.strong}, likely ${afterCounts.likely}, candidate_review ${afterCounts.candidate_review}, ambiguous ${afterCounts.ambiguous}`
  );
  console.log(`Rules written: ${rulesFile.rules.length}`);
  console.log(`Wrote: ${RULES_OUTPUT_PATH}`);
  console.log(`Wrote: ${TUNED_OUTPUT_PATH}`);
}

main();
