import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type LiveUnitConfidence = "strong" | "likely" | "candidate_review" | "ambiguous";

export type FeedbackRule = {
  rule_id: string;
  effect: "boost" | "caution";
  review_source: "approved" | "rejected" | "watch" | "needs_research";
  support_count: number;
  label: string;
  score_delta: number;
  match: {
    signal_mix?: string;
    operational_category?: string;
    subtype?: string;
    zone_id?: string;
    min_entity_score?: number;
    max_entity_score?: number;
    confidence?: LiveUnitConfidence;
  };
  rationale: string;
};

export type FeedbackRulesFile = {
  generated_at: string;
  input_paths?: Record<string, string>;
  summary: {
    approved_count: number;
    rejected_count: number;
    watch_count: number;
    needs_research_count: number;
  };
  pattern_summaries: {
    approval_patterns: Array<Record<string, unknown>>;
    caution_patterns: Array<Record<string, unknown>>;
  };
  rules: FeedbackRule[];
  notes: string[];
};

export type ReviewTunableLiveUnit = {
  live_unit_id: string;
  operational_category: string;
  subtype: string;
  signal_mix: string;
  entity_score: number;
  confidence: LiveUnitConfidence;
  raw_snippets?: {
    google?: {
      zone_id?: string;
    };
  };
};

export type AppliedFeedbackTuning = {
  matched_rules: FeedbackRule[];
  score_delta: number;
  tuned_entity_score: number;
  tuned_confidence: LiveUnitConfidence;
  explanation: string;
};

export function feedbackRulesPath() {
  return path.join(process.cwd(), "data", "markets", "beauty_match_feedback_rules.v1.json");
}

export function loadFeedbackRules(filePath = feedbackRulesPath()): FeedbackRulesFile {
  if (!existsSync(filePath)) {
    return {
      generated_at: new Date(0).toISOString(),
      summary: {
        approved_count: 0,
        rejected_count: 0,
        watch_count: 0,
        needs_research_count: 0,
      },
      pattern_summaries: {
        approval_patterns: [],
        caution_patterns: [],
      },
      rules: [],
      notes: [],
    };
  }
  return JSON.parse(readFileSync(filePath, "utf8")) as FeedbackRulesFile;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rowZoneId(row: ReviewTunableLiveUnit) {
  return row.raw_snippets?.google?.zone_id || "";
}

function matchesRule(row: ReviewTunableLiveUnit, rule: FeedbackRule) {
  const match = rule.match;
  if (match.signal_mix && row.signal_mix !== match.signal_mix) return false;
  if (match.operational_category && row.operational_category !== match.operational_category) return false;
  if (match.subtype && row.subtype !== match.subtype) return false;
  if (match.zone_id && rowZoneId(row) !== match.zone_id) return false;
  if (match.confidence && row.confidence !== match.confidence) return false;
  if (typeof match.min_entity_score === "number" && row.entity_score < match.min_entity_score) return false;
  if (typeof match.max_entity_score === "number" && row.entity_score > match.max_entity_score) return false;
  return true;
}

function tuneConfidence(
  row: ReviewTunableLiveUnit,
  tunedScore: number,
  scoreDelta: number,
  matchedRules: FeedbackRule[]
): LiveUnitConfidence {
  const hasBoost = matchedRules.some((rule) => rule.effect === "boost");
  const hasCaution = matchedRules.some((rule) => rule.effect === "caution");

  if (row.confidence === "ambiguous") return "ambiguous";
  if (row.confidence === "strong") return "strong";

  if (row.confidence === "likely") {
    if (hasCaution && (scoreDelta <= -3 || tunedScore < 72)) {
      return "candidate_review";
    }
    if (hasBoost && !hasCaution && tunedScore >= 88 && row.signal_mix === "google+dora+online") {
      return "strong";
    }
    return "likely";
  }

  if (row.confidence === "candidate_review") {
    if (hasBoost && !hasCaution && tunedScore >= 80 && row.signal_mix === "google+dora+online") {
      return "likely";
    }
    return "candidate_review";
  }

  return row.confidence;
}

export function applyFeedbackRules(
  row: ReviewTunableLiveUnit,
  rulesFile: FeedbackRulesFile
): AppliedFeedbackTuning {
  const matchedRules = [...rulesFile.rules]
    .filter((rule) => matchesRule(row, rule))
    .sort((a, b) => {
      if (Math.abs(b.score_delta) !== Math.abs(a.score_delta)) {
        return Math.abs(b.score_delta) - Math.abs(a.score_delta);
      }
      return a.rule_id.localeCompare(b.rule_id);
    });

  const positiveDelta = matchedRules
    .filter((rule) => rule.score_delta > 0)
    .reduce((sum, rule) => sum + rule.score_delta, 0);
  const negativeDelta = matchedRules
    .filter((rule) => rule.score_delta < 0)
    .reduce((sum, rule) => sum + rule.score_delta, 0);
  const scoreDelta = clamp(positiveDelta, 0, 4) + clamp(negativeDelta, -5, 0);
  const tunedEntityScore = clamp(row.entity_score + scoreDelta, 0, 100);
  const tunedConfidence = tuneConfidence(row, tunedEntityScore, scoreDelta, matchedRules);

  let explanation = "No feedback adjustment applied";
  if (matchedRules.length) {
    explanation = matchedRules
      .map((rule) => `${rule.score_delta > 0 ? "Boosted" : "Downgraded"} by ${rule.label}`)
      .join(" | ");
  }

  return {
    matched_rules: matchedRules,
    score_delta: scoreDelta,
    tuned_entity_score: tunedEntityScore,
    tuned_confidence: tunedConfidence,
    explanation,
  };
}
