import fs from "node:fs";
import path from "node:path";

function s(v: any) { return String(v ?? "").trim(); }
function n(v: any): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function writeJson(rel: string, obj: any) {
  const abs = path.resolve(process.cwd(), rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(obj, null, 2), "utf8");
}
function readJson(rel: string) {
  const abs = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(abs)) throw new Error(`Missing JSON: ${rel}`);
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}
function readJsonl(rel: string) {
  const abs = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(abs)) throw new Error(`Missing JSONL: ${rel}`);
  return fs.readFileSync(abs, "utf8").split("\n").filter(Boolean).map((ln) => JSON.parse(ln));
}

function parseAddressKey(addressKey: string) {
  const [address = "", city = "", state = "", zip = ""] = addressKey.split("|").map((part) => s(part));
  return { address, city, state, zip };
}

function pickSelectedSweepCandidate(row: any) {
  const candidates = Array.isArray(row?.sweepCandidates) ? row.sweepCandidates : [];
  const selectedPlaceId = s(row?.adjudication?.selectedCandidatePlaceId);
  if (selectedPlaceId) {
    const selected = candidates.find((candidate: any) => s(candidate?.placeId) === selectedPlaceId);
    if (selected) return selected;
  }
  return row?.effectiveTopCandidate ?? row?.topCandidate ?? candidates[0] ?? null;
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

function mapSweepEffectiveRows(rows: any[]) {
  return rows.map((row: any) => {
    const addressKey = s(row?.addressKey);
    const parsed = parseAddressKey(addressKey);
    const candidate = pickSelectedSweepCandidate(row);
    const location = candidate?.location ?? row?.geocode?.location ?? null;
    const types = Array.isArray(candidate?.types) ? candidate.types.map(String) : [];

    return {
      addressKey,
      address: parsed.address,
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
      query: s(candidate?.query || row?.source?.queries?.[0] || addressKey),
      topPlaceId: s(row?.topCandidate?.placeId || candidate?.placeId),
      chosenPlaceId: s(row?.adjudication?.selectedCandidatePlaceId || row?.effectiveTopCandidate?.placeId || candidate?.placeId),
      chosenMode: s(row?.adjudication?.decision),
      chosenReason: Array.isArray(candidate?.reasons) ? candidate.reasons.join(", ") : s(row?.adjudication?.note),
      detailsStatus: candidate ? "OK" : s(row?.geocode?.status || row?.adjudication?.decision),
      candidate: {
        placeName: s(candidate?.name),
        formattedAddress: s(candidate?.formattedAddress || candidate?.vicinity),
        address: s(candidate?.formattedAddress || candidate?.vicinity),
        website: s(candidate?.website),
        phone: s(candidate?.phone),
        url: s(candidate?.googleUrl),
        types,
        matchScore: n(candidate?.score) ?? 0,
        lat: n(location?.lat),
        lon: n(location?.lng),
        source: s(candidate?.source || "address_sweep_effective_v1"),
      },
      lat: n(location?.lat),
      lon: n(location?.lng),
    };
  });
}

function mapTop200Rows(rows: any[]) {
  return rows.map((row: any) => {
    const addressKey = s(row?.addressKey);
    const parsed = parseAddressKey(addressKey);
    const candidate = row?.candidate ?? {};

    return {
      addressKey,
      address: parsed.address,
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
      query: s(row?.query),
      topPlaceId: s(row?.topPlaceId),
      chosenPlaceId: s(row?.topPlaceId),
      chosenMode: row?.detailsStatus === "OK" ? "top200_enriched" : "",
      chosenReason: "",
      detailsStatus: s(row?.detailsStatus),
      candidate: {
        placeName: s(candidate?.placeName),
        formattedAddress: s(candidate?.formattedAddress),
        address: s(candidate?.formattedAddress),
        website: s(candidate?.website),
        phone: s(candidate?.phone),
        url: s(candidate?.url),
        types: Array.isArray(candidate?.types) ? candidate.types.map(String) : [],
        matchScore: n(candidate?.matchScore) ?? 0,
        lat: n(candidate?.lat) ?? n(candidate?.latitude) ?? null,
        lon: n(candidate?.lon) ?? n(candidate?.longitude) ?? null,
        source: s(candidate?.source || "google_textsearch+details_top200_v1"),
      },
      lat: n(candidate?.lat) ?? n(candidate?.latitude) ?? null,
      lon: n(candidate?.lon) ?? n(candidate?.longitude) ?? null,
    };
  });
}

async function main() {
  const outRel = "data/co/dora/denver_metro/places/derived/places_candidates.v1.json";
  const sweepEffectiveRel = "data/co/dora/denver_metro/places/derived/address_sweep_effective.v1.json";
  const top200Rel = "data/co/dora/denver_metro/places/derived/places_top200_enriched.v1.json";
  const rawRel = "data/co/dora/denver_metro/places/raw/places_raw.v2.jsonl";

  let rows: any[] = [];
  let sourceRel = "";

  if (fs.existsSync(path.resolve(process.cwd(), sweepEffectiveRel))) {
    const sweep = readJson(sweepEffectiveRel);
    rows = mapSweepEffectiveRows(Array.isArray(sweep?.rows) ? sweep.rows : []);
    sourceRel = sweepEffectiveRel;
  } else if (fs.existsSync(path.resolve(process.cwd(), top200Rel))) {
    const top200 = readJson(top200Rel);
    rows = mapTop200Rows(Array.isArray(top200?.rows) ? top200.rows : []);
    sourceRel = top200Rel;
  } else {
    const events = readJsonl(rawRel);
    rows = events.map((ev: any) => {
      const addressKey = s(ev.addressKey);
      const parsed = parseAddressKey(addressKey);
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
      const location = result?.geometry?.location ?? result?.location ?? null;

      const matchScore = scoreDetails(ev.details);

      return {
        addressKey,
        address: parsed.address,
        city: parsed.city,
        state: parsed.state,
        zip: parsed.zip,
        query: q,
        topPlaceId: s(ev.topPlaceId),
        chosenPlaceId: s(ev?.chosen?.placeId),
        chosenMode: s(ev?.chosen?.mode),
        chosenReason: s(ev?.chosen?.reason),
        detailsStatus: detStatus,
        candidate: {
          placeName: name,
          formattedAddress: formatted_address,
          address: formatted_address,
          website,
          phone,
          url,
          types,
          matchScore,
          lat: n(location?.lat),
          lon: n(location?.lng ?? location?.lon),
          source: "google_textsearch+details_v1.1",
        },
        lat: n(location?.lat),
        lon: n(location?.lng ?? location?.lon),
      };
    });
    sourceRel = rawRel;
  }

  writeJson(outRel, {
    ok: true,
    updatedAt: new Date().toISOString(),
    source: sourceRel,
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
