export type ProviderCandidate = {
  name: string;
  placeId?: string;
  types: string[];
  website?: string | null;
  phone?: string | null;
  googleUrl?: string | null;
  formattedAddress?: string | null;
  vicinity?: string | null;
  location?: { lat: number; lng: number } | null;
  rating?: number | null;
  userRatingsTotal?: number | null;
  query: string;
  source?: string;
};

export type ProviderDiag = {
  mode: "stub" | "google";
  hasApiKey: boolean;
  apiKeyHint: string; // "missing" | "set:1234"
  requestCounts: { queries: number; results: number };
  lastError: string | null;
};

function s(v: any) {
  return String(v ?? "").trim();
}

function qs(params: Record<string, string>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) u.set(k, v);
  return u.toString();
}

async function fetchJson(url: string) {
  const res = await fetch(url, { method: "GET" });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // ignore parse errors; handled below
  }
  if (!res.ok) {
    throw new Error(`HTTP_${res.status}: ${String(text || "").slice(0, 300)}`);
  }
  return json;
}

function formatAddressFromKey(addressKey: string) {
  const parts = String(addressKey || "")
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length < 4) return String(addressKey || "").replace(/\|/g, " ");
  const [street, city, state, zip] = parts;
  return `${street}, ${city}, ${state} ${zip}`;
}

async function geocodeAddress(address: string, apiKey: string) {
  const url = "https://maps.googleapis.com/maps/api/geocode/json?" + qs({ address, key: apiKey });
  return await fetchJson(url);
}

async function nearbySearch(lat: number, lng: number, keyword: string, apiKey: string, radiusMeters = 350) {
  const url =
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json?" +
    qs({
      location: `${lat},${lng}`,
      radius: String(radiusMeters),
      keyword,
      key: apiKey,
    });
  return await fetchJson(url);
}

function toCandidate(r: any, keyword: string): ProviderCandidate {
  return {
    name: s(r?.name),
    placeId: s(r?.place_id) || undefined,
    types: Array.isArray(r?.types) ? r.types.map(String) : [],
    vicinity: s(r?.vicinity) || null,
    formattedAddress: s(r?.vicinity) || null,
    location: r?.geometry?.location
      ? { lat: Number(r.geometry.location.lat) || 0, lng: Number(r.geometry.location.lng) || 0 }
      : null,
    rating: typeof r?.rating === "number" ? r.rating : null,
    userRatingsTotal: typeof r?.user_ratings_total === "number" ? r.user_ratings_total : null,
    website: null,
    phone: null,
    googleUrl: null,
    query: keyword,
    source: `nearby:${keyword}`,
  };
}

export async function fetchSweepCandidatesForAddress(addressKey: string, diag: ProviderDiag) {
  const apiKey = (process.env.GOOGLE_MAPS_API_KEY || "").trim();
  diag.hasApiKey = !!apiKey;
  diag.apiKeyHint = diag.hasApiKey ? `set:${apiKey.slice(-4)}` : "missing";

  if (!apiKey) {
    diag.mode = "stub";
    return { geocode: null, candidates: [] as ProviderCandidate[], queries: [] as string[] };
  }

  diag.mode = "google";
  const address = formatAddressFromKey(addressKey);

  try {
    diag.requestCounts.queries += 1;
    const gj = await geocodeAddress(address, apiKey);

    if (gj?.status !== "OK" || !Array.isArray(gj?.results) || gj.results.length === 0) {
      return {
        geocode: { status: gj?.status ?? "UNKNOWN", address },
        candidates: [] as ProviderCandidate[],
        queries: [address],
      };
    }

    const g0 = gj.results[0];
    const loc = g0?.geometry?.location;
    const lat = Number(loc?.lat);
    const lng = Number(loc?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return {
        geocode: { status: "NO_LOCATION", address },
        candidates: [] as ProviderCandidate[],
        queries: [address],
      };
    }

    const keywords = ["nail salon", "hair salon", "salon suites", "beauty salon"];
    const all: ProviderCandidate[] = [];
    const queries = [address, ...keywords.map((k) => `nearby:${k}`)];

    for (const kw of keywords) {
      diag.requestCounts.queries += 1;
      const nj = await nearbySearch(lat, lng, kw, apiKey, 350);
      const results = Array.isArray(nj?.results) ? nj.results : [];
      diag.requestCounts.results += results.length;
      for (const r of results) all.push(toCandidate(r, kw));
    }

    const seen = new Set<string>();
    const dedup: ProviderCandidate[] = [];
    for (const c of all) {
      const k = c.placeId ? `pid:${c.placeId}` : `nv:${c.name}::${c.vicinity || ""}`;
      if (seen.has(k)) continue;
      seen.add(k);
      dedup.push(c);
    }

    return {
      geocode: {
        status: "OK",
        address,
        formattedAddress: g0?.formatted_address ?? null,
        placeId: g0?.place_id ?? null,
        location: { lat, lng },
      },
      candidates: dedup,
      queries,
    };
  } catch (e: any) {
    diag.lastError = e?.message || String(e);
    return {
      geocode: { status: "ERROR", address, error: diag.lastError },
      candidates: [] as ProviderCandidate[],
      queries: [address],
    };
  }
}
