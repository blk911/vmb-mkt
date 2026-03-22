import {
  marketsJsonPath,
  readJsonIfExists,
  resolveZoneMembersJsonPath,
} from "@/lib/markets/fsCatalog";

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
  category_raw?: string;
  category_source_labels_raw?: string[];
  google_types_raw?: string[];
  category: string;
  subtype: string;
  source: string;
  priority_score: number;
  is_anchor: boolean;
  nearby_dora_licenses_total?: number;
  nearby_dora_hair_count?: number;
  nearby_dora_nail_count?: number;
  nearby_dora_esthe_count?: number;
  nearby_dora_barber_count?: number;
  nearby_dora_spa_count?: number;
  nearby_dora_operational_mix?: {
    hair: number;
    nail: number;
    esthe: number;
    barber: number;
    spa: number;
  };
  nearby_dora_profession_mix_raw?: Record<string, number>;
  dora_density_radius_miles?: number;
  dora_density_profile?: string;
  /** Miles: DORA addresses at this distance from listing GPS (same order as density ring). */
  nearby_dora_instore_threshold_miles?: number;
  /** DORA registered addresses within density radius, closest first. */
  nearby_dora_addresses_ranked?: Array<{
    addressKey: string;
    distance_miles: number;
    license_count: number;
    hair: number;
    nail: number;
    esthe: number;
    barber: number;
    spa: number;
  }>;
  /** Individual roster rows within radius, sorted by distance (capped in enrich script). */
  nearby_dora_licenses_ranked?: Array<{
    fullName: string;
    licenseType: string;
    licenseStatus: string;
    rowId: string;
    addressKey: string;
    distance_miles: number;
  }>;
  /** Count of license rows at DORA addresses within `nearby_dora_instore_threshold_miles` of listing GPS. */
  nearby_dora_instore_likely_count?: number;
  /** Remaining license rows in the density ring (further than instore threshold). */
  nearby_dora_ring_count?: number;
  /** Optional: merged from `site_identity` / enriched pipeline (outbound links on crawled site). */
  instagram_url?: string | null;
  instagram_handle?: string | null;
  facebook_url?: string | null;
  tiktok_url?: string | null;
  yelp_url?: string | null;
  linktree_url?: string | null;
  booking_url?: string | null;
  booking_provider?: string | null;
  /** Supplemental: anchor directory ingest (`merge_anchor_directory_into_markets.py`); does not replace site_identity fields. */
  anchor_directory_matched?: boolean;
  anchor_directory_brand?: string | null;
  anchor_directory_location_name?: string | null;
  anchor_directory_profile_url?: string | null;
  anchor_directory_instagram_url?: string | null;
  anchor_directory_instagram_handle?: string | null;
  anchor_directory_booking_url?: string | null;
  anchor_directory_booking_provider?: string | null;
  anchor_directory_phone?: string | null;
  anchor_directory_website_url?: string | null;
  anchor_directory_match_type?: string | null;
  anchor_directory_match_confidence?: string | null;
  anchor_directory_match_notes?: string[] | null;
  /** Supplemental: path-based cluster enrichment (`merge_path_enrichment_into_markets.py`); does not replace site_identity. */
  path_enrichment_matched?: boolean | null;
  path_enrichment_match_count?: number | null;
  path_enrichment_best_source_type?: string | null;
  path_enrichment_best_confidence?: string | null;
  path_enrichment_instagram_url?: string | null;
  path_enrichment_instagram_handle?: string | null;
  path_enrichment_booking_url?: string | null;
  path_enrichment_booking_provider?: string | null;
  path_enrichment_phone?: string | null;
  path_enrichment_website_url?: string | null;
  path_enrichment_source_url?: string | null;
  path_enrichment_match_notes?: string | null;
  /** Supplemental: gray-pin AUTO merge (`merge_gray_pin_matches_into_markets.py`); not primary site_identity. */
  gray_resolution_matched?: boolean | null;
  gray_resolution_score?: number | null;
  gray_resolution_match_count?: number | null;
  gray_resolution_match_url?: string | null;
  gray_resolution_match_title?: string | null;
  gray_resolution_match_name?: string | null;
  gray_resolution_match_address?: string | null;
  gray_resolution_instagram_url?: string | null;
  gray_resolution_booking_url?: string | null;
  gray_resolution_booking_provider?: string | null;
  gray_resolution_source_query?: string | null;
  gray_resolution_match_notes?: string | null;
};

export type BeautyZoneCluster = {
  zone_id: string;
  cluster_id: string;
  cluster_rank: number;
  member_count: number;
  categories_present: string[];
  top_member_names: string[];
  has_suite: boolean;
  largest_cluster: boolean;
};

export type EnrichedBeautyZoneMember = BeautyZoneMember & {
  cluster_id: string;
  cluster_size: number;
  upgraded_priority_score: number;
  in_largest_cluster: boolean;
};

export type ApprovedLiveUnit = {
  live_unit_id: string;
  name_display: string;
  operational_category: string;
  subtype: string;
  signal_mix: string;
  confidence: string;
  entity_score: number;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lon: number | null;
  primary_zone_id: string | null;
  primary_zone_name: string | null;
  linked_zones: Array<{
    zone_id: string;
    zone_name: string;
    market: string;
    distance_miles?: number;
  }>;
  explanation: string;
};

type RegionsFile = {
  regions: BeautyRegion[];
};

type ZonesFile = {
  zones: BeautyZone[];
};

type ZoneMembersFile = {
  generated_at?: string;
  input_candidates_path?: string;
  input_zones_path?: string;
  count?: number;
  counts?: Record<string, number>;
  members: BeautyZoneMember[];
};

type ApprovedLiveUnitsFile = {
  rows?: ApprovedLiveUnit[];
};

function loadRegions(): RegionsFile {
  const parsed = readJsonIfExists<RegionsFile>(marketsJsonPath("beauty_regions.json"));
  return parsed ?? { regions: [] };
}

function loadZones(): ZonesFile {
  const parsed = readJsonIfExists<ZonesFile>(marketsJsonPath("beauty_zones.json"));
  return parsed ?? { zones: [] };
}

/** Reads `beauty_zone_members_enriched_full.json` if present, else with_presence_and_anchor, etc. (see `resolveZoneMembersJsonPath`). */
function loadZoneMembers(): ZoneMembersFile {
  const filePath = resolveZoneMembersJsonPath();
  if (!filePath) return { members: [] };
  const parsed = readJsonIfExists<ZoneMembersFile>(filePath);
  return parsed ?? { members: [] };
}

function loadApprovedLiveUnits(): ApprovedLiveUnitsFile {
  const parsed = readJsonIfExists<ApprovedLiveUnitsFile>(
    marketsJsonPath("beauty_live_units_approved.v1.json")
  );
  return parsed ?? { rows: [] };
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

export function getApprovedLiveUnits(): ApprovedLiveUnit[] {
  return loadApprovedLiveUnits().rows || [];
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Resolve a single enriched zone member by stable `location_id` (for detail routes). */
export function getEnrichedMemberByLocationId(locationId: string): EnrichedBeautyZoneMember | null {
  const { members } = getZoneMembersWithClusters();
  return members.find((m) => m.location_id === locationId) ?? null;
}

export function getZoneMembersWithClusters(): {
  members: EnrichedBeautyZoneMember[];
  clusters: BeautyZoneCluster[];
} {
  const members = getZoneMembers();
  const CLUSTER_THRESHOLD_MILES = 0.12;

  const enrichedMembers: EnrichedBeautyZoneMember[] = [];
  const clusters: BeautyZoneCluster[] = [];

  const membersByZone = new Map<string, BeautyZoneMember[]>();
  for (const member of members) {
    const zoneMembers = membersByZone.get(member.zone_id) ?? [];
    zoneMembers.push(member);
    membersByZone.set(member.zone_id, zoneMembers);
  }

  for (const [zoneId, zoneMembers] of membersByZone.entries()) {
    const visited = new Set<number>();
    const components: number[][] = [];

    for (let i = 0; i < zoneMembers.length; i++) {
      if (visited.has(i)) continue;

      const queue = [i];
      const component: number[] = [];
      visited.add(i);

      while (queue.length) {
        const current = queue.shift()!;
        component.push(current);
        const currentMember = zoneMembers[current];

        for (let j = 0; j < zoneMembers.length; j++) {
          if (visited.has(j)) continue;
          const nextMember = zoneMembers[j];
          const distance = haversineMiles(
            currentMember.lat,
            currentMember.lon,
            nextMember.lat,
            nextMember.lon
          );
          if (distance <= CLUSTER_THRESHOLD_MILES) {
            visited.add(j);
            queue.push(j);
          }
        }
      }

      components.push(component);
    }

    const sortedComponents = components
      .map((component) => component.map((index) => zoneMembers[index]))
      .sort((a, b) => {
        if (b.length !== a.length) return b.length - a.length;
        const topA = Math.max(...a.map((member) => member.priority_score));
        const topB = Math.max(...b.map((member) => member.priority_score));
        return topB - topA;
      });

    const largestClusterSize = sortedComponents[0]?.length ?? 0;

    sortedComponents.forEach((clusterMembers, index) => {
      const clusterId = `${zoneId}_cluster_${index + 1}`;
      const clusterSize = clusterMembers.length;
      const hasSuite = clusterMembers.some((member) => member.subtype === "suite");

      const upgradedMembers = clusterMembers.map((member) => {
        let upgradedPriorityScore = member.priority_score;

        if (member.subtype === "suite") upgradedPriorityScore += 2;
        if (clusterSize >= 2) upgradedPriorityScore += 2 + Math.min(clusterSize - 2, 2);
        if (largestClusterSize >= 2 && clusterSize === largestClusterSize) upgradedPriorityScore += 3;

        return {
          ...member,
          cluster_id: clusterId,
          cluster_size: clusterSize,
          upgraded_priority_score: upgradedPriorityScore,
          in_largest_cluster: clusterSize === largestClusterSize && largestClusterSize > 0,
        };
      });

      upgradedMembers
        .sort((a, b) => {
          if (b.upgraded_priority_score !== a.upgraded_priority_score) {
            return b.upgraded_priority_score - a.upgraded_priority_score;
          }
          return a.name.localeCompare(b.name);
        })
        .forEach((member) => enrichedMembers.push(member));

      clusters.push({
        zone_id: zoneId,
        cluster_id: clusterId,
        cluster_rank: index + 1,
        member_count: clusterSize,
        categories_present: Array.from(new Set(clusterMembers.map((member) => member.category))).sort(),
        top_member_names: upgradedMembers.slice(0, 3).map((member) => member.name),
        has_suite: hasSuite,
        largest_cluster: clusterSize === largestClusterSize && largestClusterSize > 0,
      });
    });
  }

  return { members: enrichedMembers, clusters };
}
