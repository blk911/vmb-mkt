import path from "path";
import fs from "node:fs";
import { dataRootAbs } from "../../../../api/admin/_lib/paths";

export const REL_MATCHED_EFFECTIVE =
  "data/co/dora/denver_metro/places/derived/places_matched_effective.v1.json";
export const REL_MATCHED_FACILITIES =
  "data/co/dora/denver_metro/places/derived/places_matched_facilities.v1.json";
export const REL_TECH_INDEX = "data/co/dora/denver_metro/places/derived/tech_index.v4.json";
export const REL_SWEEP_CANDIDATES =
  "data/co/dora/denver_metro/places/derived/address_sweep_candidates.v1.json";
export const REL_SWEEP_ADJUDICATIONS =
  "data/co/dora/denver_metro/places/derived/address_sweep_adjudications.v1.json";
export const REL_SWEEP_EFFECTIVE =
  "data/co/dora/denver_metro/places/derived/address_sweep_effective.v1.json";
export const REL_RECEIPTS_DIR = "data/co/dora/denver_metro/places/receipts";

export function matchedEffectiveAbs() {
  return path.join(dataRootAbs(), "co", "dora", "denver_metro", "places", "derived", "places_matched_effective.v1.json");
}

export function matchedFacilitiesAbs() {
  return path.join(
    dataRootAbs(),
    "co",
    "dora",
    "denver_metro",
    "places",
    "derived",
    "places_matched_facilities.v1.json"
  );
}

export function techIndexAbs() {
  return path.join(dataRootAbs(), "co", "dora", "denver_metro", "places", "derived", "tech_index.v4.json");
}

export function sweepCandidatesAbs() {
  return path.join(
    dataRootAbs(),
    "co",
    "dora",
    "denver_metro",
    "places",
    "derived",
    "address_sweep_candidates.v1.json"
  );
}

export function sweepAdjudicationsAbs() {
  return path.join(
    dataRootAbs(),
    "co",
    "dora",
    "denver_metro",
    "places",
    "derived",
    "address_sweep_adjudications.v1.json"
  );
}

export function sweepEffectiveAbs() {
  return path.join(
    dataRootAbs(),
    "co",
    "dora",
    "denver_metro",
    "places",
    "derived",
    "address_sweep_effective.v1.json"
  );
}

export function sweepReceiptsDirAbs() {
  return path.join(dataRootAbs(), "co", "dora", "denver_metro", "places", "receipts");
}

export async function readSweepCandidates() {
  const abs = sweepCandidatesAbs();
  if (!fs.existsSync(abs)) return { ok: true, rows: [], counts: { rows: 0 } };
  const raw = fs.readFileSync(abs, "utf8");
  return JSON.parse(raw);
}
