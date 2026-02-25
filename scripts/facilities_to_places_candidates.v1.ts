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

function splitAddressKey(addressKey: string) {
  const parts = s(addressKey).split("|").map((x) => x.trim());
  return {
    address1: parts[0] || "",
    city: parts[1] || "",
    state: parts[2] || "",
    zip: parts[3] || "",
  };
}

function readJson(rel: string): AnyObj {
  const abs = repoAbs(rel);
  if (!fs.existsSync(abs)) throw new Error(`Missing file: ${rel}`);
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function writeJson(rel: string, obj: AnyObj) {
  ensureDirForFile(rel);
  fs.writeFileSync(repoAbs(rel), JSON.stringify(obj, null, 2), "utf8");
}

async function main() {
  const inRel = "data/co/dora/denver_metro/facilities/derived/facility_index.v1.json";
  const outRel = "data/co/dora/denver_metro/places/derived/places_candidates_facilities.v1.json";

  const doc = readJson(inRel);
  const facilities: AnyObj[] = Array.isArray(doc?.facilities) ? doc.facilities : [];

  const byAk = new Map<string, AnyObj>();
  for (const f of facilities) {
    const addressKey = s(f?.addressKey);
    if (!addressKey) continue;
    const p = splitAddressKey(addressKey);
    const brand = s(f?.brand);
    const locationLabel = s(f?.locationLabel);
    const placeName = locationLabel ? `${brand} - ${locationLabel}` : brand;

    byAk.set(addressKey, {
      addressKey,
      candidate: {
        placeName,
        address1: p.address1,
        city: p.city,
        state: p.state,
        zip: p.zip,
        brand,
        category: s(f?.category),
        locationLabel,
        source: "facility_seed",
      },
    });
  }

  const rows = Array.from(byAk.values()).sort((a, b) =>
    s(a.addressKey).localeCompare(s(b.addressKey))
  );

  writeJson(outRel, {
    ok: true,
    kind: "places_candidates",
    version: "v1_facility_expansion",
    source: { rel: inRel },
    counts: { rows: rows.length },
    rows,
    updatedAt: new Date().toISOString(),
  });

  console.log({
    ok: true,
    inRel,
    outRel,
    counts: { facilities: facilities.length, rows: rows.length },
  });
}

main().catch((e) => {
  console.error("places:facilities:candidates failed:", e?.message || e);
  process.exit(1);
});
