import fs from "node:fs";
import path from "node:path";

const FAC = "data/co/dora/denver_metro/tables/vmb_facilities_enriched.json";
const OUT = "data/co/dora/denver_metro/overrides/place_overrides.v1.json";

function mustReadJson(rel: string) {
  const abs = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(abs)) throw new Error(`Missing ${rel}`);
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function ensureDir(relFile: string) {
  fs.mkdirSync(path.dirname(path.resolve(process.cwd(), relFile)), { recursive: true });
}

function main() {
  const fac = mustReadJson(FAC);
  const rows = Array.isArray(fac?.rows) ? fac.rows : [];

  const queue: string[] = rows
    .filter((r: any) => r?.needsConfirm === true)
    .map((r: any) => String(r.addressKey));

  const existing = fs.existsSync(path.resolve(process.cwd(), OUT)) ? mustReadJson(OUT) : null;
  const existingRows: any[] = Array.isArray(existing?.rows) ? existing.rows : [];
  const existingMap = new Map(existingRows.map((r) => [String(r.addressKey), r]));

  const merged = queue.map((addressKey: string) => {
    const prev = existingMap.get(addressKey);
    if (prev) return prev;
    return {
      addressKey,
      placeType: "unknown", // suite | salon | home | maildrop | unknown
      placeName: null,
      franchiseBrandId: null,
      confidence: 0, // 0-100
      notes: "",
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressKey.replace(/\s*\|\s*/g, " "))}`,
      website: null,
      phone: null,
      ig: null
    };
  });

  ensureDir(OUT);
  fs.writeFileSync(
    path.resolve(process.cwd(), OUT),
    JSON.stringify({ ok: true, updatedAt: new Date().toISOString(), rows: merged }, null, 2),
    "utf8"
  );

  console.log(`WROTE ${OUT}`);
  console.log({ needsConfirm: queue.length, overridesRows: merged.length });
}

main();
