import { readFileSync } from "node:fs";
import path from "node:path";

export type BeautyRegion = {
  region_id: string;
  region_name: string;
  status: string;
};

export type BeautyZone = {
  zone_id: string;
  zone_name: string;
  region_id: string;
  region_name: string;
  market: string;
  center_lat: number;
  center_lon: number;
  radius_miles: number;
  status: string;
  notes?: string;
};

export type BeautyZoneMember = {
  zone_id: string;
  zone_name: string;
  market: string;
  location_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lon: number;
  distance_miles: number;
  category: string;
  subtype: string;
  source: string;
  priority_score: number;
  is_anchor: boolean;
};

type RegionsFile = {
  regions: BeautyRegion[];
};

type ZonesFile = {
  zones: BeautyZone[];
};

type ZoneMembersFile = {
  generated_at: string;
  input_candidates_path: string;
  input_zones_path: string;
  count: number;
  members: BeautyZoneMember[];
};

function loadRegions(): RegionsFile {
  const filePath = path.join(process.cwd(), "data", "markets", "beauty_regions.json");
  return JSON.parse(readFileSync(filePath, "utf8")) as RegionsFile;
}

function loadZones(): ZonesFile {
  const filePath = path.join(process.cwd(), "data", "markets", "beauty_zones.json");
  return JSON.parse(readFileSync(filePath, "utf8")) as ZonesFile;
}

function loadZoneMembers(): ZoneMembersFile {
  const filePath = path.join(process.cwd(), "data", "markets", "beauty_zone_members.json");
  return JSON.parse(readFileSync(filePath, "utf8")) as ZoneMembersFile;
}

export function getRegions(): BeautyRegion[] {
  return loadRegions().regions;
}

export function getMarkets(): BeautyZone[] {
  return loadZones().zones;
}

export function getZonesByRegion(regionId: string): BeautyZone[] {
  return loadZones().zones.filter((z) => z.region_id === regionId);
}

export function getMarketById(id: string): BeautyZone | undefined {
  return loadZones().zones.find((z) => z.zone_id === id);
}

export function getZoneMembers(): BeautyZoneMember[] {
  return loadZoneMembers().members;
}
