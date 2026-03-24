/**
 * Structured outputs for Build Mode operational sections (zone-scoped queues).
 */
import type { DerivedBuildItemState } from "./zone-build-reason-types";

export interface ZoneUnresolvedCandidate {
  id: string;
  name: string;
  zoneId: string;
  distance?: number;
  entityKind?: string;
  hasInstagram?: boolean;
  hasBooking?: boolean;
  serviceSignals?: string[];
  derived: DerivedBuildItemState;
}

export interface ZonePotentialAnchor {
  id: string;
  name: string;
  techCountNearby?: number;
  hasStorefrontSignal?: boolean;
  hasBooking?: boolean;
  derived: DerivedBuildItemState;
}

export interface ZonePlatformSignalItem {
  id: string;
  name: string;
  platform: string;
  isBookable: boolean;
  /** Member stitched row vs approved live unit platformSignals row. */
  source: "member" | "live_unit";
  derived: DerivedBuildItemState;
}

export interface ZoneBuildOpsData {
  unresolved: ZoneUnresolvedCandidate[];
  anchors: ZonePotentialAnchor[];
  platforms: ZonePlatformSignalItem[];
}
