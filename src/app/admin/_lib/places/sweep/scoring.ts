import type { AddressClass, SweepCandidate } from "./types";

const BEAUTY_TYPES = new Set([
  "beauty_salon",
  "hair_salon",
  "nail_salon",
  "spa",
  "barber_shop",
  "hair_care",
  "eyelash_salon",
  "waxing_hair_removal_service",
]);

const RESIDENTIAL_TYPES = new Set([
  "apartment_complex",
  "apartment_building",
  "real_estate_agency",
]);

const SUITE_BRANDS = [
  "SALON LOFTS",
  "SOLA",
  "PHENIX",
  "MY SALON SUITE",
  "SUMMIT SALON STUDIOS",
  "IMAGE STUDIOS",
];

function up(v: any) {
  return String(v ?? "").toUpperCase().trim();
}

function parseAddressKey(addressKey: string) {
  const parts = String(addressKey || "")
    .split("|")
    .map((x) => x.trim());
  return {
    addr1: parts[0] || "",
    city: parts[1] || "",
    st: parts[2] || "",
    zip: parts[3] || "",
  };
}

function stateFromAddressKey(addressKey: string) {
  const parts = String(addressKey || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 4) return (parts[2] || "").toUpperCase();
  return "";
}

function extractStreetBits(addr: string) {
  const cleaned = up(addr).replace(/[.,#]/g, " ");
  const m = cleaned.match(/^(\d+)\s+(.+)$/);
  if (!m) return { num: "", street: cleaned.replace(/\s+/g, " ").trim() };
  return { num: m[1], street: m[2].replace(/\s+/g, " ").trim() };
}

export function candidateKey(c: Partial<SweepCandidate>) {
  return `${up(c.placeId || "")}|${up(c.name || "")}|${up(c.formattedAddress || "")}`;
}

export function classifyAndScoreCandidate(candidate: {
  name: string;
  types?: string[];
  formattedAddress?: string | null;
  website?: string | null;
  phone?: string | null;
  googleUrl?: string | null;
  query: string;
  placeId?: string;
  vicinity?: string | null;
  location?: { lat: number; lng: number } | null;
  rating?: number | null;
  userRatingsTotal?: number | null;
  source?: string;
  sourceAddressKey: string;
  geocodeLocation?: { lat: number; lng: number } | null;
}): SweepCandidate {
  const reasons: string[] = [];
  const types = Array.isArray(candidate.types) ? candidate.types.map((x) => String(x || "").trim()).filter(Boolean) : [];
  const typesUp = types.map(up);
  const parsed = parseAddressKey(candidate.sourceAddressKey);
  const srcBits = extractStreetBits(parsed.addr1);
  const cAddr = up(candidate.formattedAddress || "");

  let score = 0;

  const beautyHits = typesUp.filter((t) => BEAUTY_TYPES.has(t)).length;
  if (beautyHits > 0) {
    score += 3 + Math.min(beautyHits, 2);
    reasons.push(`beauty_types:${beautyHits}`);
  }

  const residentialHits = typesUp.filter((t) => RESIDENTIAL_TYPES.has(t)).length;
  if (residentialHits > 0) {
    score -= 3 + Math.min(residentialHits, 2);
    reasons.push(`residential_types:${residentialHits}`);
  }

  const nameUp = up(candidate.name);
  if (SUITE_BRANDS.some((b) => nameUp.includes(b))) {
    score += 3;
    reasons.push("suite_brand_name");
  }

  if (candidate.website) {
    score += 2;
    reasons.push("has_website");
  }
  if (candidate.phone) {
    score += 2;
    reasons.push("has_phone");
  }

  const streetMatch = !!srcBits.street && cAddr.includes(srcBits.street);
  const numMatch = !!srcBits.num && cAddr.includes(srcBits.num);
  const zipMatch = !!parsed.zip && cAddr.includes(parsed.zip);
  const atAddress = streetMatch && numMatch && zipMatch;
  if (atAddress) {
    score += 4;
    reasons.push("strict_address_match");
  } else if (streetMatch && zipMatch) {
    score += 2;
    reasons.push("street_zip_match");
  }

  const gl = candidate.geocodeLocation;
  const cl = candidate.location;
  if (gl && cl && Number.isFinite(gl.lat) && Number.isFinite(gl.lng) && Number.isFinite(cl.lat) && Number.isFinite(cl.lng)) {
    const toRad = (n: number) => (n * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(cl.lat - gl.lat);
    const dLon = toRad(cl.lng - gl.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(gl.lat)) * Math.cos(toRad(cl.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const meters = R * c;
    if (meters < 75) {
      score += 3;
      reasons.push("distance_lt_75m");
    } else if (meters < 150) {
      score += 2;
      reasons.push("distance_lt_150m");
    } else if (meters < 300) {
      score += 1;
      reasons.push("distance_lt_300m");
    }
  }

  if (score > 100) score = 100;
  if (score < -100) score = -100;

  return {
    name: candidate.name,
    placeId: candidate.placeId,
    types,
    website: candidate.website || null,
    phone: candidate.phone || null,
    googleUrl: candidate.googleUrl || null,
    formattedAddress: candidate.formattedAddress || null,
    vicinity: candidate.vicinity || null,
    location: candidate.location || null,
    rating: candidate.rating ?? null,
    userRatingsTotal: candidate.userRatingsTotal ?? null,
    source: candidate.source || undefined,
    query: candidate.query,
    atAddress,
    score,
    reasons,
  };
}

export function suggestAddressClass(input: {
  addressKey?: string;
  hasAcceptedFacility: boolean;
  topCandidate: SweepCandidate | null;
  candidates: SweepCandidate[];
  doraLicenses: number;
  uniqueTechs: number;
  activeCount: number | null;
  geocodeStatus?: string | null;
}): { addressClass: AddressClass; confidence: number; reasons: string[]; needsExternalSweep: boolean } {
  const reasons: string[] = [];
  const ak = String(input?.addressKey || "").toUpperCase();
  const top = input.topCandidate;
  const needsExternalSweep = input.candidates.length === 0;
  const hasBeautyTop = !!top?.reasons?.some((r) => r.startsWith("beauty_types"));
  const hasResidentialTop = !!top?.reasons?.some((r) => r.startsWith("residential_types"));
  const highDensity = input.doraLicenses >= 15 || input.uniqueTechs >= 6;
  const geocodeStatus = String(input?.geocodeStatus || "");

  // PATCH E — PO BOX / mail drop classification (very safe)
  if (ak.startsWith("PO BOX ") || ak.startsWith("P.O. BOX ") || ak.startsWith("POB ")) {
    if (!reasons.includes("po_box_maildrop")) reasons.push("po_box_maildrop");
    return {
      addressClass: "maildrop",
      confidence: 0.9,
      reasons,
      needsExternalSweep,
    };
  }

  // PATCH F — Out-of-scope state tagging (non-CO)
  const st = stateFromAddressKey(input?.addressKey || "");
  if (st && st !== "CO") {
    if (!reasons.includes("out_of_scope_state")) reasons.push("out_of_scope_state");
    if (!reasons.includes(`state_${st}`)) reasons.push(`state_${st}`);
    return {
      addressClass: "unknown",
      confidence: 0.75,
      reasons,
      needsExternalSweep,
    };
  }

  if (input.hasAcceptedFacility) {
    return { addressClass: "storefront", confidence: 1, reasons: ["facility_overlay_accepted"], needsExternalSweep: false };
  }

  // PATCH A — Residential/no-storefront auto-classification (safe)
  if (
    geocodeStatus === "OK" &&
    Array.isArray(input.candidates) &&
    input.candidates.length === 0 &&
    (input.uniqueTechs ?? 0) <= 1 &&
    (input.doraLicenses ?? 0) <= 2
  ) {
    if (!reasons.includes("geocode_ok_no_nearby_hits")) reasons.push("geocode_ok_no_nearby_hits");
    if (!reasons.includes("low_license_density")) reasons.push("low_license_density");
    return {
      addressClass: "residential",
      confidence: 0.8,
      reasons,
      needsExternalSweep,
    };
  }

  if (top && top.score >= 34 && hasBeautyTop && !hasResidentialTop) {
    reasons.push(`top_candidate_score:${top.score}`);
    return { addressClass: "storefront", confidence: 0.8, reasons, needsExternalSweep };
  }

  // PATCH C — Suite-center likely (high density multi-license address)
  if (highDensity && (!top || top.score < 34)) {
    if (!reasons.includes("high_density_multi_license")) reasons.push("high_density_multi_license");
    return {
      addressClass: "suite_center",
      confidence: 0.7,
      reasons,
      needsExternalSweep,
    };
  }

  if (top && hasResidentialTop && !hasBeautyTop) {
    reasons.push("residential_poi_dominant");
    if (highDensity) reasons.push("high_density_may_indicate_center");
    return { addressClass: "residential", confidence: highDensity ? 0.52 : 0.68, reasons, needsExternalSweep };
  }

  if (
    input.doraLicenses >= 6 &&
    input.activeCount != null &&
    input.activeCount <= 1 &&
    (!top || top.score <= 0)
  ) {
    reasons.push("low_active_vs_total");
    return { addressClass: "maildrop", confidence: 0.6, reasons, needsExternalSweep };
  }

  reasons.push("insufficient_signals");
  if (needsExternalSweep) reasons.push("needs_external_sweep");
  return { addressClass: "unknown", confidence: 0.35, reasons, needsExternalSweep };
}
