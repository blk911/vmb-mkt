import fs from "node:fs";
import path from "node:path";

function readJson(rel: string) {
  const abs = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(abs)) throw new Error(`Missing file: ${rel}`);
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}
function writeJson(rel: string, obj: any) {
  const abs = path.resolve(process.cwd(), rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(obj, null, 2), "utf8");
}
function s(v: any) { return String(v ?? "").trim(); }
function n(v: any, d = 0) { const x = Number(v); return Number.isFinite(x) ? x : d; }

function normalizePlaceType(types: string[]) {
  const t = new Set(types.map((x) => String(x)));
  if (t.has("beauty_salon") || t.has("hair_care") || t.has("spa")) return "salon";
  return "unknown";
}

async function main() {
  const cfgRel = "data/co/dora/denver_metro/places/cfg/places_enrich.v1.json";
  const cfg = readJson(cfgRel);
  const minScore = n(cfg.minScoreToAutoMatch, 70);

  const candMergedRel = "data/co/dora/denver_metro/places/derived/places_candidates.v1_merged.json";
  const candBaseRel = "data/co/dora/denver_metro/places/derived/places_candidates.v1.json";
  const candRel = fs.existsSync(path.resolve(process.cwd(), candMergedRel))
    ? candMergedRel
    : candBaseRel;
  const cand = readJson(candRel);

  const outRel = "data/co/dora/denver_metro/places/derived/places_matched.v1.json";
  const sumRel = "data/co/dora/denver_metro/places/derived/places_matched_summary.v1.json";

  const matched: any[] = [];
  const needsReview: any[] = [];
  const rows: any[] = [];

  for (const r of cand.rows ?? []) {
    const ak = s(r.addressKey);
    const c = r.candidate;
    const score = n(c?.matchScore, 0);

    const row = {
      addressKey: ak,
      placeName: s(c?.placeName),
      placeType: normalizePlaceType(Array.isArray(c?.types) ? c.types : []),
      formattedAddress: s(c?.formattedAddress),
      website: s(c?.website) || null,
      phone: s(c?.phone) || null,
      googleUrl: s(c?.url) || null,
      googleTypes: c?.types ?? [],
      matchScore: score,
      source: s(c?.source),
      fetchedAt: new Date().toISOString(),
    };
    rows.push(row);

    if (score >= minScore) matched.push(row);
    else needsReview.push(row);
  }

  const counts = { matched: matched.length, needsReview: needsReview.length };
  const outDoc = {
    ok: true,
    kind: "places_matched",
    version: "v1",
    updatedAt: new Date().toISOString(),
    counts,
    rows,
  };
  if (!Array.isArray(rows)) throw new Error("places_match_table: rows is not an array");
  if (rows.length === 0 && (counts?.needsReview || counts?.matched)) {
    console.warn("WARN: counts indicate matches but rows is empty; writing anyway.");
  }
  writeJson(outRel, outDoc);

  writeJson(sumRel, {
    ok: true,
    updatedAt: new Date().toISOString(),
    counts,
    sampleNeedsReview: needsReview.slice(0, 50),
  });

  console.log("WROTE", outRel);
  console.log("WROTE", sumRel);
  console.log({ matched: matched.length, needsReview: needsReview.length, minScore });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
