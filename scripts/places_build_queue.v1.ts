import fs from "node:fs";
import path from "node:path";

type FacilitiesFile = { rows: any[] };

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

function bestName(r: any) {
  const pn = s(r.placeName);
  if (pn) return pn;
  const bn = s(r.businessName);
  if (bn && bn.toLowerCase() !== "unknown") return bn;
  return "Unknown";
}
function queryFromAddressKey(addressKey: string) {
  return addressKey.replace(/\s*\|\s*/g, " ");
}
function scoreRow(r: any) {
  const tech = n(r.techCountAtAddress, 0);
  const active = Math.max(0, Math.min(1, n(r.activeShare, 0)));
  const hasReg = !!r.hasReg;
  const cat = s(r.category);

  let score = 0;
  score += tech >= 10 ? 30 : tech >= 5 ? 20 : tech >= 2 ? 10 : 0;
  score += active >= 0.8 ? 30 : active >= 0.6 ? 20 : active >= 0.4 ? 10 : 0;
  score += hasReg ? 5 : 0;
  score += cat === "suite-cluster" ? 10 : 0;
  score += cat === "indie-salon" ? 5 : 0;
  return score;
}

async function main() {
  const cfgRel = "data/co/dora/denver_metro/places/cfg/places_enrich.v1.json";
  const cfg = readJson(cfgRel);

  const facRel = "data/co/dora/denver_metro/tables/vmb_facilities_enriched.json";
  const fac = readJson(facRel) as FacilitiesFile;

  const include = new Set<string>(cfg.includeCategories ?? []);
  const exclude = new Set<string>(cfg.excludeCategories ?? []);

  const maxPerRun = n(cfg.maxPerRun, 200);
  const minTechCount = n(cfg.minTechCount, 2);
  const minActiveShare = n(cfg.minActiveShare, 0.5);
  const requireUnknownName = !!cfg.requireUnknownName;

  const rows = (fac.rows ?? [])
    .filter((r) => {
      const cat = s(r.category);
      if (include.size && !include.has(cat)) return false;
      if (exclude.has(cat)) return false;
      if (n(r.techCountAtAddress, 0) < minTechCount) return false;
      if (n(r.activeShare, 0) < minActiveShare) return false;
      if (requireUnknownName && bestName(r) !== "Unknown") return false;
      return true;
    })
    .map((r) => ({
      addressKey: s(r.addressKey),
      category: s(r.category),
      techCountAtAddress: n(r.techCountAtAddress, 0),
      activeShare: n(r.activeShare, 0),
      hasReg: !!r.hasReg,
      query: queryFromAddressKey(s(r.addressKey)),
      score: scoreRow(r),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPerRun);

  const outRel = "data/co/dora/denver_metro/places/queue/places_queue.v1.json";
  writeJson(outRel, {
    ok: true,
    updatedAt: new Date().toISOString(),
    counts: { queued: rows.length },
    rows,
  });

  console.log("WROTE", outRel);
  console.log({ queued: rows.length, top: rows[0] ?? null });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
