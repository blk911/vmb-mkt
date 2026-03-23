/**
 * Structured outputs for Build Mode operational sections (zone-scoped queues).
 */

export interface ZoneUnresolvedCandidate {
  id: string;
  name: string;
  zoneId: string;
  distance?: number;
  entityKind?: string;
  hasInstagram?: boolean;
  hasBooking?: boolean;
  serviceSignals?: string[];
}

export interface ZonePotentialAnchor {
  id: string;
  name: string;
  techCountNearby?: number;
  hasStorefrontSignal?: boolean;
  hasBooking?: boolean;
}

export interface ZonePlatformSignalItem {
  id: string;
  name: string;
  platform: string;
  isBookable: boolean;
}

export interface ZoneBuildOpsData {
  unresolved: ZoneUnresolvedCandidate[];
  anchors: ZonePotentialAnchor[];
  platforms: ZonePlatformSignalItem[];
}
