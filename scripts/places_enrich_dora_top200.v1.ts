import fs from "node:fs";
import path from "node:path";

type AnyObj = Record<string, any>;

const IN_TOP200 = "data/co/dora/denver_metro/dora/derived/dora_address_top200.v1.json";
const RAW_OUT = "data/co/dora/denver_metro/places/raw/places_top200_raw.v1.jsonl";
const DERIVED_OUT = "data/co/dora/denver_metro/places/derived/places_top200_enriched.v1.json";

const RATE_LIMIT_MS = Number(process.env.VMB_PLACES_RATE_LIMIT_MS || "120") || 120;
const MAX_PER_RUN = Number(process.env.VMB_PLACES_TOP200_MAX_PER_RUN || "200") || 200;
const FORCE_REPULL = String(process.env.VMB_PLACES_FORCE || "").trim() === "1";

function repoAbs(rel: string) {
  return path.resolve(process.cwd(), rel);
}

function ensureDirForFile(rel: string) {
  const abs = repoAbs(rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function s(v: any) {
  return String(v ?? "").trim();
}

function readJson(rel: string): AnyObj {
  const abs = repoAbs(rel);
  if (!fs.existsSync(abs)) throw new Error(`Missing file: ${rel}`);
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function loadSeen(rawRel: string) {
  const abs = repoAbs(rawRel);
  const seen = new Set<string>();
  if (!fs.existsSync(abs)) return seen;
  const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    try {
      const j = JSON.parse(t);
      const key = s(j.addressKey);
      if (key) seen.add(key);
    } catch {
      // ignore corrupt lines
    }
  }
  return seen;
}

async function googleTextSearch(apiKey: string, query: string) {
  const u = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  u.searchParams.set("query", query);
  u.searchParams.set("key", apiKey);
  const res = await fetch(u.toString());
  return res.json();
}

async function googlePlaceDetails(apiKey: string, placeId: string) {
  const fieldMask = [
    "id",
    "displayName",
    "formattedAddress",
    "addressComponents",
    "primaryType",
    "types",
    "websiteUri",
    "nationalPhoneNumber",
    "googleMapsUri",
    "containingPlaces",
    "addressDescriptor",
  ].join(",");

  const u = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  const res = await fetch(u.toString(), {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
  });
  const json = await res.json();
  return {
    status: res.ok ? "OK" : String(json?.error?.status || `HTTP_${res.status}`),
    result: json,
  };
}

function scoreDetails(result: AnyObj) {
  let score = 0;
  const name = s(result?.displayName?.text ?? result?.name);
  const website = s(result?.websiteUri ?? result?.website);
  const phone = s(result?.nationalPhoneNumber ?? result?.formatted_phone_number);
  const types = Array.isArray(result?.types) ? result.types.map(String) : [];

  if (name) score += 30;
  if (website) score += 15;
  if (phone) score += 10;
  if (types.includes("beauty_salon")) score += 30;
  if (types.includes("hair_care")) score += 10;
  if (types.includes("spa")) score += 8;
  return score;
}

function makeQuery(addressKey: string) {
  return `${addressKey.replace(/\s*\|\s*/g, " ")} beauty salon`;
}

function pickText(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v?.text === "string") return v.text;
  return null;
}

function extractCenter(details: any): {
  inCenter: boolean;
  centerName: string | null;
  centerPlaceId: string | null;
  centerSource: "containingPlaces" | "addressDescriptor" | "none";
} {
  const cp = Array.isArray(details?.containingPlaces) ? details.containingPlaces : [];
  if (cp.length) {
    const name = pickText(cp[0]?.displayName) || null;
    const id = (cp[0]?.id || cp[0]?.name || null) as string | null;
    if (name) return { inCenter: true, centerName: name, centerPlaceId: id, centerSource: "containingPlaces" };
  }

  const lm = details?.addressDescriptor?.landmarks;
  if (Array.isArray(lm) && lm.length) {
    const best = lm.find((x: any) => pickText(x?.displayName)) || lm[0];
    const name = pickText(best?.displayName) || null;
    const id = (best?.placeId || best?.id || null) as string | null;
    if (name) return { inCenter: true, centerName: name, centerPlaceId: id, centerSource: "addressDescriptor" };
  }

  return { inCenter: false, centerName: null, centerPlaceId: null, centerSource: "none" };
}

function deriveRowFromEvent(ev: AnyObj): AnyObj | null {
  const addressKey = s(ev?.addressKey);
  if (!addressKey) return null;
  const details = ev?.details || {};
  const candidate = details?.result ?? {};
  return {
    addressKey,
    query: s(ev?.query),
    topPlaceId: s(ev?.topPlaceId),
    detailsStatus: s(details?.status || ev?.detailsStatus),
    center: extractCenter(candidate),
    candidate: {
      placeName: s(candidate?.displayName?.text ?? candidate?.name),
      formattedAddress: s(candidate?.formattedAddress ?? candidate?.formatted_address),
      website: s(candidate?.websiteUri ?? candidate?.website),
      phone: s(candidate?.nationalPhoneNumber ?? candidate?.formatted_phone_number),
      url: s(candidate?.googleMapsUri ?? candidate?.url),
      types: Array.isArray(candidate?.types) ? candidate.types : [],
      matchScore: scoreDetails(candidate),
      source: "google_textsearch+details_top200_v1",
    },
  };
}

async function main() {
  const apiKey = s(process.env.GOOGLE_PLACES_API_KEY);
  if (!apiKey) {
    throw new Error("Missing GOOGLE_PLACES_API_KEY");
  }

  const top = readJson(IN_TOP200);
  const anchors: AnyObj[] = Array.isArray(top?.anchors) ? top.anchors : [];
  ensureDirForFile(RAW_OUT);
  ensureDirForFile(DERIVED_OUT);

  const seen = loadSeen(RAW_OUT);
  const out = fs.createWriteStream(repoAbs(RAW_OUT), { flags: "a" });

  const selected = anchors.slice(0, MAX_PER_RUN);
  let pulled = 0;
  let skippedSeen = 0;
  let failed = 0;

  const derivedRows: AnyObj[] = [];

  for (const a of selected) {
    const addressKey = s(a?.addressKey);
    if (!addressKey) continue;
    if (!FORCE_REPULL && seen.has(addressKey)) {
      skippedSeen++;
      continue;
    }

    const query = makeQuery(addressKey);
    try {
      const text = await googleTextSearch(apiKey, query);
      const results: AnyObj[] = Array.isArray(text?.results) ? text.results : [];
      const topResult = results[0] || null;
      const topPlaceId = s(topResult?.place_id);

      let details: AnyObj = { status: "NO_TOP_RESULT" };
      if (topPlaceId) {
        details = await googlePlaceDetails(apiKey, topPlaceId);
      }

      const candidate = details?.result ?? {};
      const ev = {
        ts: new Date().toISOString(),
        addressKey,
        query,
        topPlaceId,
        textStatus: s(text?.status),
        detailsStatus: s(details?.status),
        text,
        details,
      };
      out.write(JSON.stringify(ev) + "\n");

      derivedRows.push({
        addressKey,
        query,
        topPlaceId,
        detailsStatus: s(details?.status),
        center: extractCenter(candidate),
        candidate: {
          placeName: s(candidate?.displayName?.text ?? candidate?.name),
          formattedAddress: s(candidate?.formattedAddress ?? candidate?.formatted_address),
          website: s(candidate?.websiteUri ?? candidate?.website),
          phone: s(candidate?.nationalPhoneNumber ?? candidate?.formatted_phone_number),
          url: s(candidate?.googleMapsUri ?? candidate?.url),
          types: Array.isArray(candidate?.types) ? candidate.types : [],
          matchScore: scoreDetails(candidate),
          source: "google_textsearch+details_top200_v1",
        },
      });

      pulled++;
      seen.add(addressKey);
      if (RATE_LIMIT_MS > 0) await sleep(RATE_LIMIT_MS);
    } catch (e: any) {
      failed++;
      const ev = {
        ts: new Date().toISOString(),
        addressKey,
        query,
        error: s(e?.message || e),
      };
      out.write(JSON.stringify(ev) + "\n");
      if (RATE_LIMIT_MS > 0) await sleep(RATE_LIMIT_MS);
    }
  }

  out.end();
  await new Promise<void>((resolve) => out.on("finish", () => resolve()));

  // Build a deterministic latest-by-address derived set from full RAW history.
  const latestByAddress = new Map<string, AnyObj>();
  const rawLines = fs.readFileSync(repoAbs(RAW_OUT), "utf8").split(/\r?\n/);
  for (const line of rawLines) {
    const t = line.trim();
    if (!t) continue;
    try {
      const ev = JSON.parse(t);
      const row = deriveRowFromEvent(ev);
      if (!row) continue;
      latestByAddress.set(row.addressKey, row);
    } catch {
      // ignore parse errors in raw history
    }
  }
  const mergedDerivedRows = Array.from(latestByAddress.values()).sort((a, b) =>
    String(a.addressKey).localeCompare(String(b.addressKey))
  );

  fs.writeFileSync(
    repoAbs(DERIVED_OUT),
    JSON.stringify(
      {
        ok: true,
        updatedAt: new Date().toISOString(),
        counts: { inTop: anchors.length, selected: selected.length, pulled, skippedSeen, failed },
        rows: mergedDerivedRows,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log({
    ok: true,
    wrote: [RAW_OUT, DERIVED_OUT],
    counts: { inTop: anchors.length, selected: selected.length, pulled, skippedSeen, failed },
    cfg: { rateLimitMs: RATE_LIMIT_MS, maxPerRun: MAX_PER_RUN, forceRepull: FORCE_REPULL },
  });
}

main().catch((e) => {
  console.error("places:enrich:top200 failed:", e?.message || e);
  process.exit(1);
});
