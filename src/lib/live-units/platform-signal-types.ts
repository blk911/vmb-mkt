/**
 * Booking platform listings as support signals only — never entity creation.
 * Attach only to existing validated Live Unit rows at high confidence.
 */

export type PlatformType = "fresha" | "vagaro" | "booksy" | "glossgenius";

export interface PlatformListing {
  platform: PlatformType;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  services: string[];
  bookingUrl: string;
}

export interface PlatformMatchScore {
  nameScore: number;
  distanceScore: number;
  serviceScore: number;
  totalScore: number;
}

export interface AttachedPlatformSignal {
  platform: PlatformType;
  bookingUrl: string;
  isBookable: boolean;
  serviceCount: number;
  matchedAt: string;
}

/** One attached signal per platform per entity (partial map). */
export type PlatformSignalsRecord = Partial<Record<PlatformType, AttachedPlatformSignal>>;

/** Minimal row shape for matching (existing entities only). */
export type LiveUnitForPlatformMatch = {
  live_unit_id: string;
  entity_id?: string;
  name_display: string;
  operational_category: string;
  subtype?: string;
  signal_mix: string;
  explanation?: string;
  lat?: number | null;
  lon?: number | null;
};
