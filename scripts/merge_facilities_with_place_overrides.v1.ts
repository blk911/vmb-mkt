import fs from "node:fs";
import path from "node:path";

const FAC = "data/co/dora/denver_metro/tables/vmb_facilities_enriched.json";
const OVR = "data/co/dora/denver_metro/overrides/place_overrides.v1.json";
const OUT = "data/co/dora/denver_metro/tables/vmb_facilities_enriched.json";

function mustReadJson(rel: string) {
  const abs = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(abs)) throw new Error(`Missing ${rel}`);
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}
function ensureDir(relFile: string) {
  fs.mkdirSync(path.dirname(path.resolve(process.cwd(), relFile)), { recursive: true });
}
function s(v: any) {
  return String(v ?? "").trim();
}

function main() {
  const fac = mustReadJson(FAC);
  const rows = Array.isArray(fac?.rows) ? fac.rows : [];

  if (!fs.existsSync(path.resolve(process.cwd(), OVR))) {
    console.log(`No overrides file at ${OVR}. Run: npm run seed:place-overrides`);
    process.exit(0);
  }

  const ovr = mustReadJson(OVR);
  const oRows = Array.isArray(ovr?.rows) ? ovr.rows : [];
  const map = new Map<string, any>(oRows.map((r: any) => [s(r.addressKey), r]));

  let applied = 0;

  const outRows = rows.map((r: any) => {
    const key = s(r.addressKey);
    const o = map.get(key);
    if (!o) return r;

    applied++;

    // apply confirmed truth fields only when set (don't blank existing)
    if (o.placeType && o.placeType !== "unknown") r.placeType = o.placeType;
    if (o.placeName) r.placeName = o.placeName;
    if (o.franchiseBrandId) r.franchiseBrandId = o.franchiseBrandId;
    if (typeof o.confidence === "number") r.placeConfidence = o.confidence;
    if (o.notes) r.placeNotes = o.notes;

    if (o.website) r.website = o.website;
    if (o.phone) r.phone = o.phone;
    if (o.ig) r.ig = o.ig;
    if (o.mapsUrl) r.mapsUrl = o.mapsUrl;

    // once confirmed, clear needsConfirm
    const conf = typeof r.placeConfidence === "number" ? r.placeConfidence : 0;
    if (r.placeType && r.placeType !== null && r.placeType !== "unknown" && conf >= 60) {
      r.needsConfirm = false;
    }

    return r;
  });

  const payload = {
    ok: true,
    updatedAt: new Date().toISOString(),
    counts: { facilities: outRows.length, overridesApplied: applied },
    rows: outRows,
  };

  ensureDir(OUT);
  fs.writeFileSync(path.resolve(process.cwd(), OUT), JSON.stringify(payload, null, 2), "utf8");
  console.log(`WROTE ${OUT}`);
  console.log(payload.counts);
}

main();
