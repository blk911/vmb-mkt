import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import LiveUnitsClient from "./LiveUnitsClient";
import { readReviewState, type ReviewDecision } from "@/app/admin/_lib/live-units/review-state";

type LiveUnitRow = {
  live_unit_id: string;
  name_display: string;
  operational_category: string;
  subtype?: string;
  confidence: "strong" | "likely" | "candidate_review" | "ambiguous";
  tuned_confidence?: "strong" | "likely" | "candidate_review" | "ambiguous";
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
    original_confidence?: "strong" | "likely" | "candidate_review" | "ambiguous";
    score_delta?: number;
    explanation?: string;
  };
  shop_license?: string | null;
  shop_license_name?: string | null;
  shop_distance?: number | null;
  association_confidence?: "strong" | "likely" | "weak" | null;
  tech_count_nearby?: number;
};

type LiveUnitsFile = {
  rows?: LiveUnitRow[];
};

type ReviewStateMap = Record<string, ReviewDecision>;

type LoadedLiveUnits = {
  rows: LiveUnitRow[];
  source: "shop_context" | "tuned" | "base";
};

function loadLiveUnits(): LoadedLiveUnits {
  const shopContextPath = path.join(process.cwd(), "data", "markets", "beauty_live_units_shop_context.v1.json");
  const tunedPath = path.join(process.cwd(), "data", "markets", "beauty_live_units_tuned.v1.json");
  const basePath = path.join(process.cwd(), "data", "markets", "beauty_live_units.v1.json");

  const filePath = existsSync(shopContextPath)
    ? shopContextPath
    : existsSync(tunedPath)
      ? tunedPath
      : basePath;
  const source: LoadedLiveUnits["source"] =
    filePath === shopContextPath ? "shop_context" : filePath === tunedPath ? "tuned" : "base";
  if (!existsSync(filePath)) return { rows: [], source };
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as LiveUnitsFile;
  return {
    rows: Array.isArray(parsed.rows) ? parsed.rows : [],
    source,
  };
}

function loadReviewState(): ReviewStateMap {
  return readReviewState().decisions;
}

export default function LiveUnitsPage() {
  const liveUnits = loadLiveUnits();
  const reviewState = loadReviewState();
  return (
    <LiveUnitsClient
      rows={liveUnits.rows}
      source={liveUnits.source}
      initialReviewState={reviewState}
    />
  );
}
