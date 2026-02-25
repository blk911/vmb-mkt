import fs from "node:fs";
import path from "node:path";

type AnyObj = Record<string, any>;

function repoAbs(rel: string) {
  return path.resolve(process.cwd(), rel);
}

function ensureDirForFile(rel: string) {
  const abs = repoAbs(rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
}

function s(v: any) {
  return String(v ?? "").trim();
}

function readJsonSafe(rel: string): AnyObj {
  const abs = repoAbs(rel);
  if (!fs.existsSync(abs)) return {};
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function writeJson(rel: string, obj: AnyObj) {
  ensureDirForFile(rel);
  fs.writeFileSync(repoAbs(rel), JSON.stringify(obj, null, 2), "utf8");
}

async function main() {
  const baseRel = "data/co/dora/denver_metro/places/derived/places_candidates.v1.json";
  const facRel = "data/co/dora/denver_metro/places/derived/places_candidates_facilities.v1.json";
  const outRel = "data/co/dora/denver_metro/places/derived/places_candidates.v1_merged.json";

  const base = readJsonSafe(baseRel);
  const fac = readJsonSafe(facRel);

  const baseRows: AnyObj[] = Array.isArray(base?.rows) ? base.rows : [];
  const facRows: AnyObj[] = Array.isArray(fac?.rows) ? fac.rows : [];

  // Keep existing candidates first; add facility rows only for unseen addressKey.
  const byAk = new Map<string, AnyObj>();
  for (const r of baseRows) {
    const ak = s(r?.addressKey);
    if (!ak) continue;
    if (!byAk.has(ak)) byAk.set(ak, r);
  }

  let addedFromFacilities = 0;
  let skippedFacilityDuplicates = 0;
  for (const r of facRows) {
    const ak = s(r?.addressKey);
    if (!ak) continue;
    if (byAk.has(ak)) {
      skippedFacilityDuplicates += 1;
      continue;
    }
    byAk.set(ak, r);
    addedFromFacilities += 1;
  }

  const rows = Array.from(byAk.values()).sort((a, b) =>
    s(a.addressKey).localeCompare(s(b.addressKey))
  );

  writeJson(outRel, {
    ok: true,
    kind: "places_candidates",
    version: "v1_merged_facilities",
    source: {
      base: baseRel,
      facilities: facRel,
    },
    counts: {
      baseRows: baseRows.length,
      facilityRows: facRows.length,
      addedFromFacilities,
      skippedFacilityDuplicates,
      rows: rows.length,
    },
    rows,
    updatedAt: new Date().toISOString(),
  });

  console.log({
    ok: true,
    wrote: outRel,
    counts: {
      baseRows: baseRows.length,
      facilityRows: facRows.length,
      addedFromFacilities,
      skippedFacilityDuplicates,
      rows: rows.length,
    },
  });
}

main().catch((e) => {
  console.error("places:candidates:merge failed:", e?.message || e);
  process.exit(1);
});
