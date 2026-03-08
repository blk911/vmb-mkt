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

type RegionsFile = {
  regions: BeautyRegion[];
};

type ZonesFile = {
  zones: BeautyZone[];
};

function loadRegions(): RegionsFile {
  const filePath = path.join(process.cwd(), "data", "markets", "beauty_regions.json");
  return JSON.parse(readFileSync(filePath, "utf8")) as RegionsFile;
}

function loadZones(): ZonesFile {
  const filePath = path.join(process.cwd(), "data", "markets", "beauty_zones.json");
  return JSON.parse(readFileSync(filePath, "utf8")) as ZonesFile;
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
