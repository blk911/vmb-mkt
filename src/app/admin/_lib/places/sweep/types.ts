export type AddressClass = "storefront" | "suite_center" | "maildrop" | "residential" | "unknown";

export type SweepCandidate = {
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
  source?: string;
  query: string;
  atAddress: boolean;
  score: number;
  reasons: string[];
};

export type SweepRow = {
  addressKey: string;
  addressClass: AddressClass;
  sweepCandidates: SweepCandidate[];
  topCandidate: SweepCandidate | null;
  confidence: number;
  reasons: string[];
  geocode?: {
    status?: string;
    address?: string;
    formattedAddress?: string | null;
    placeId?: string | null;
    location?: { lat: number; lng: number } | null;
    error?: string;
  } | null;
  source: {
    mode: "google" | "stub";
    queries: string[];
    fetchedAt: string;
  };
  context?: {
    hasAcceptedFacility?: boolean;
    facilityBrand?: string | null;
    doraLicenses?: number;
    uniqueTechs?: number;
    activeCount?: number | null;
  };
};

export type SweepCandidatesDoc = {
  ok: true;
  kind: "address_sweep_candidates";
  version: "v1";
  source: {
    matchedEffective: string;
    matchedFacilities: string;
    techIndex: string;
  };
  counts: {
    rows: number;
    storefront: number;
    suite_center: number;
    maildrop: number;
    residential: number;
    unknown: number;
    needsExternalSweep: number;
    noExternalHits: number;
  };
  provider?: {
    mode: "stub" | "google";
    hasApiKey: boolean;
    apiKeyHint: string;
    requestCounts: { queries: number; results: number };
    lastError: string | null;
  };
  rows: SweepRow[];
  updatedAt: string;
};

export type SweepDecision =
  | "confirm_candidate"
  | "suite_center"
  | "residential"
  | "unknown"
  | "no_storefront"
  | "rejected";

export type SweepAdjudication = {
  addressKey: string;
  decision: SweepDecision;
  selectedCandidatePlaceId?: string;
  selectedCandidateName?: string;
  note?: string;
  decidedAt: string;
};
