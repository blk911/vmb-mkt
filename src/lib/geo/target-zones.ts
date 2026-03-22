export interface GeoTargetZone {
  id: string;
  label: string;
  centerLat: number;
  centerLng: number;
  radiusMiles: number;
  priority: number;
  active: boolean;
}

/** Pinned target zones (Denver–Front Range). */
export const TARGET_ZONES: GeoTargetZone[] = [
  {
    id: "DOWNTOWN_CORE",
    label: "Downtown Core",
    centerLat: 39.7439,
    centerLng: -104.9959,
    radiusMiles: 0.6,
    priority: 1,
    active: true,
  },
  {
    id: "CHERRY_CREEK",
    label: "Cherry Creek",
    centerLat: 39.7197,
    centerLng: -104.9538,
    radiusMiles: 0.5,
    priority: 1,
    active: true,
  },
  {
    id: "QUEBEC_CORRIDOR",
    label: "Quebec Corridor",
    centerLat: 39.567222,
    centerLng: -104.959583,
    radiusMiles: 0.75,
    priority: 1,
    active: true,
  },
  {
    id: "WESTMINSTER_CORE",
    label: "Westminster Core",
    centerLat: 39.8617,
    centerLng: -105.0505,
    radiusMiles: 1.0,
    priority: 1,
    active: true,
  },
  {
    id: "LAFAYETTE_CORE",
    label: "Lafayette Core",
    centerLat: 39.9936,
    centerLng: -105.0897,
    radiusMiles: 0.75,
    priority: 1,
    active: true,
  },
  {
    id: "THORNTON_EAST_I25",
    label: "Thornton East / I-25",
    centerLat: 39.868,
    centerLng: -104.971,
    radiusMiles: 1.0,
    priority: 1,
    active: true,
  },
  {
    id: "FORT_COLLINS_CORE",
    label: "Fort Collins Core",
    centerLat: 40.558222,
    centerLng: -105.078028,
    radiusMiles: 1.0,
    priority: 2,
    active: true,
  },
];

const BY_ID = new Map(TARGET_ZONES.map((z) => [z.id, z]));

export function getTargetZoneById(id: string): GeoTargetZone | undefined {
  return BY_ID.get(id);
}
