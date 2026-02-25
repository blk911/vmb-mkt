import fs from "node:fs";
import path from "node:path";

function s(v: any) { return String(v ?? "").trim(); }
function writeJson(rel: string, obj: any) {
  const abs = path.resolve(process.cwd(), rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(obj, null, 2), "utf8");
}
function readJsonl(rel: string) {
  const abs = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(abs)) throw new Error(`Missing JSONL: ${rel}`);
  return fs.readFileSync(abs, "utf8").split("\n").filter(Boolean).map((ln) => JSON.parse(ln));
}

function scoreDetails(details: any) {
  // deterministic: prefer “real business” details + known salon types
  let score = 0;
  const result = details?.response?.result ?? null;
  if (!result) return 0;

  const name = s(result.name);
  const website = s(result.website);
  const phone = s(result.formatted_phone_number);
  const types = Array.isArray(result.types) ? result.types.map(String) : [];

  if (name) score += 30;
  if (website) score += 15;
  if (phone) score += 10;

  if (types.includes("beauty_salon")) score += 30;
  if (types.includes("hair_care")) score += 10;
  if (types.includes("spa")) score += 8;

  return score;
}

async function main() {
  const rawRel = "data/co/dora/denver_metro/places/raw/places_raw.v2.jsonl";
  const events = readJsonl(rawRel);

  const outRel = "data/co/dora/denver_metro/places/derived/places_candidates.v1.json";

  const rows = events.map((ev: any) => {
    const addressKey = s(ev.addressKey);
    const q = s(ev.query);

    const det = ev.details?.response ?? null;
    const detStatus = s(det?.status);

    const result = det?.result ?? null;
    const name = s(result?.name);
    const formatted_address = s(result?.formatted_address);
    const website = s(result?.website);
    const phone = s(result?.formatted_phone_number);
    const url = s(result?.url);
    const types = Array.isArray(result?.types) ? result.types : [];

    const matchScore = scoreDetails(ev.details);

    return {
      addressKey,
      query: q,
      topPlaceId: s(ev.topPlaceId),
      chosenPlaceId: s(ev?.chosen?.placeId),
      chosenMode: s(ev?.chosen?.mode),
      chosenReason: s(ev?.chosen?.reason),
      detailsStatus: detStatus,
      candidate: {
        placeName: name,
        formattedAddress: formatted_address,
        website,
        phone,
        url,
        types,
        matchScore,
        source: "google_textsearch+details_v1.1",
      },
    };
  });

  writeJson(outRel, {
    ok: true,
    updatedAt: new Date().toISOString(),
    counts: { addresses: rows.length },
    rows,
  });

  console.log("WROTE", outRel);
  console.log({ addresses: rows.length });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
