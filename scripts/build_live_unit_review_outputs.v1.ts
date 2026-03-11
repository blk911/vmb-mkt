import fs from "node:fs";
import path from "node:path";

type ReviewStatus = "approved" | "rejected" | "watch" | "needs_research";

type BeautyZone = {
  zone_id: string;
  zone_name: string;
  market: string;
  center_lat: number;
  center_lon: number;
  radius_miles: number;
};

type LiveUnitRow = {
  live_unit_id: string;
  name_display: string;
  operational_category: string;
  subtype?: string;
  confidence: "strong" | "likely" | "candidate_review" | "ambiguous";
  signal_mix: string;
  entity_score: number;
  explanation: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  lat?: number | null;
  lon?: number | null;
  raw_snippets?: Record<string, unknown>;
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

type LinkedZone = {
  zone_id: string;
  zone_name: string;
  market: string;
  distance_miles?: number;
};

type ApprovedLiveUnitRow = {
  live_unit_id: string;
  name_display: string;
  operational_category: string;
  subtype: string;
  signal_mix: string;
  confidence: string;
  entity_score: number;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lon: number | null;
  primary_zone_id: string | null;
  primary_zone_name: string | null;
  linked_zones: LinkedZone[];
  explanation: string;
};

type FeedbackRow = {
  live_unit_id: string;
  review_status: ReviewStatus;
  reviewed_at: string;
  reviewed_by?: string;
  name_display: string;
  operational_category: string;
  subtype: string;
  confidence: string;
  signal_mix: string;
  entity_score: number;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lon: number | null;
  explanation: string;
  raw_snippets?: Record<string, unknown>;
};

const ROOT = process.cwd();
const LIVE_UNITS_PATH = path.join(ROOT, "data", "markets", "beauty_live_units.v1.json");
const REVIEW_STATE_PATH = path.join(ROOT, "data", "markets", "beauty_live_units_review_state.v1.json");
const ZONES_PATH = path.join(ROOT, "data", "markets", "beauty_zones.json");
const APPROVED_OUTPUT_PATH = path.join(ROOT, "data", "markets", "beauty_live_units_approved.v1.json");
const FEEDBACK_OUTPUT_PATH = path.join(ROOT, "data", "markets", "beauty_live_units_feedback.v1.json");

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function ensureDirForFile(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function s(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function linkedZonesForRow(row: LiveUnitRow, zones: BeautyZone[]): LinkedZone[] {
  const linked: LinkedZone[] = [];
  if (isNumber(row.lat) && isNumber(row.lon)) {
    for (const zone of zones) {
      const distance = haversineMiles(row.lat, row.lon, zone.center_lat, zone.center_lon);
      if (distance <= zone.radius_miles) {
        linked.push({
          zone_id: zone.zone_id,
          zone_name: zone.zone_name,
          market: zone.market,
          distance_miles: Number(distance.toFixed(3)),
        });
      }
    }
  }

  const google = row.raw_snippets?.google as { zone_id?: string; zone_name?: string } | undefined;
  const fallbackZoneId = s(google?.zone_id);
  if (fallbackZoneId && !linked.some((zone) => zone.zone_id === fallbackZoneId)) {
    const zoneDef = zones.find((zone) => zone.zone_id === fallbackZoneId);
    linked.push({
      zone_id: fallbackZoneId,
      zone_name: s(google?.zone_name) || zoneDef?.zone_name || fallbackZoneId,
      market: zoneDef?.market || "",
    });
  }

  return linked.sort((a, b) => {
    const distanceA = typeof a.distance_miles === "number" ? a.distance_miles : Number.POSITIVE_INFINITY;
    const distanceB = typeof b.distance_miles === "number" ? b.distance_miles : Number.POSITIVE_INFINITY;
    if (distanceA !== distanceB) return distanceA - distanceB;
    return a.zone_id.localeCompare(b.zone_id);
  });
}

function toApprovedRow(row: LiveUnitRow, zones: BeautyZone[]): ApprovedLiveUnitRow {
  const linkedZones = linkedZonesForRow(row, zones);
  return {
    live_unit_id: row.live_unit_id,
    name_display: row.name_display,
    operational_category: row.operational_category,
    subtype: s(row.subtype) || "unknown",
    signal_mix: row.signal_mix,
    confidence: row.confidence,
    entity_score: row.entity_score,
    city: s(row.city),
    state: s(row.state),
    zip: s(row.zip),
    lat: isNumber(row.lat) ? row.lat : null,
    lon: isNumber(row.lon) ? row.lon : null,
    primary_zone_id: linkedZones[0]?.zone_id || null,
    primary_zone_name: linkedZones[0]?.zone_name || null,
    linked_zones: linkedZones,
    explanation: row.explanation,
  };
}

function toFeedbackRow(row: LiveUnitRow, review: ReviewDecision): FeedbackRow {
  return {
    live_unit_id: row.live_unit_id,
    review_status: review.review_status,
    reviewed_at: review.updated_at,
    reviewed_by: review.updated_by,
    name_display: row.name_display,
    operational_category: row.operational_category,
    subtype: s(row.subtype) || "unknown",
    confidence: row.confidence,
    signal_mix: row.signal_mix,
    entity_score: row.entity_score,
    city: s(row.city),
    state: s(row.state),
    zip: s(row.zip),
    lat: isNumber(row.lat) ? row.lat : null,
    lon: isNumber(row.lon) ? row.lon : null,
    explanation: row.explanation,
    raw_snippets: row.raw_snippets,
  };
}

function main() {
  const liveUnitsFile = readJson<LiveUnitsFile>(LIVE_UNITS_PATH);
  const reviewStateFile = readJson<ReviewStateFile>(REVIEW_STATE_PATH);
  const zonesFile = readJson<{ zones: BeautyZone[] }>(ZONES_PATH);

  const rows = [...(liveUnitsFile.rows || [])].sort((a, b) => a.live_unit_id.localeCompare(b.live_unit_id));
  const reviewDecisions = reviewStateFile.decisions || {};

  const approvedRows = rows
    .filter((row) => reviewDecisions[row.live_unit_id]?.review_status === "approved")
    .map((row) => toApprovedRow(row, zonesFile.zones))
    .sort((a, b) => {
      if (b.entity_score !== a.entity_score) return b.entity_score - a.entity_score;
      return [a.primary_zone_id || "", a.city, a.zip, a.name_display, a.live_unit_id].join("|").localeCompare(
        [b.primary_zone_id || "", b.city, b.zip, b.name_display, b.live_unit_id].join("|")
      );
    });

  const feedbackRows = rows
    .filter((row) => {
      const reviewStatus = reviewDecisions[row.live_unit_id]?.review_status;
      return reviewStatus === "rejected" || reviewStatus === "watch" || reviewStatus === "needs_research";
    })
    .map((row) => toFeedbackRow(row, reviewDecisions[row.live_unit_id]!))
    .sort((a, b) => {
      if (a.review_status !== b.review_status) return a.review_status.localeCompare(b.review_status);
      if (b.entity_score !== a.entity_score) return b.entity_score - a.entity_score;
      return [a.city, a.zip, a.name_display, a.live_unit_id].join("|").localeCompare(
        [b.city, b.zip, b.name_display, b.live_unit_id].join("|")
      );
    });

  const counts = {
    approved: approvedRows.length,
    rejected: feedbackRows.filter((row) => row.review_status === "rejected").length,
    ambiguous: feedbackRows.filter((row) => row.confidence === "ambiguous").length,
    needs_research: feedbackRows.filter((row) => row.review_status === "needs_research").length,
    watch: feedbackRows.filter((row) => row.review_status === "watch").length,
  };

  const approvedOutput = {
    generated_at: new Date().toISOString(),
    input_paths: {
      live_units: LIVE_UNITS_PATH,
      review_state: REVIEW_STATE_PATH,
      zones: ZONES_PATH,
    },
    count: approvedRows.length,
    rows: approvedRows,
  };

  const feedbackOutput = {
    generated_at: new Date().toISOString(),
    input_paths: {
      live_units: LIVE_UNITS_PATH,
      review_state: REVIEW_STATE_PATH,
    },
    counts,
    count: feedbackRows.length,
    rows: feedbackRows,
  };

  ensureDirForFile(APPROVED_OUTPUT_PATH);
  ensureDirForFile(FEEDBACK_OUTPUT_PATH);
  fs.writeFileSync(APPROVED_OUTPUT_PATH, JSON.stringify(approvedOutput, null, 2), "utf8");
  fs.writeFileSync(FEEDBACK_OUTPUT_PATH, JSON.stringify(feedbackOutput, null, 2), "utf8");

  console.log(`Approved count: ${counts.approved}`);
  console.log(`Rejected count: ${counts.rejected}`);
  console.log(`Ambiguous count: ${counts.ambiguous}`);
  console.log(`Needs research count: ${counts.needs_research}`);
  console.log(`Watch count: ${counts.watch}`);
  console.log(`Wrote: ${APPROVED_OUTPUT_PATH}`);
  console.log(`Wrote: ${FEEDBACK_OUTPUT_PATH}`);
}

main();
