import LiveUnitsClient from "./LiveUnitsClient";
import { readReviewState, type ReviewDecision } from "@/app/admin/_lib/live-units/review-state";
import {
  readSalonTechLinksReviewState,
  type SalonTechLinkReviewDecision,
} from "@/app/admin/_lib/live-units/salon-tech-links-review-state";
import { loadLiveUnitsWithTrace } from "@/lib/live-units/live-units-loader";
import type { LiveUnitsLoadTrace } from "@/lib/live-units/live-units-debug-types";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type LiveUnitRow = {
  live_unit_id: string;
  entity_id?: string;
  name_display: string;
  operational_category: string;
  subtype?: string;
  confidence: "strong" | "likely" | "candidate_review" | "ambiguous";
  tuned_confidence?: "strong" | "likely" | "candidate_review" | "ambiguous";
  signal_mix: string;
  city: string | null;
  zip: string | null;
  entity_score: number;
  tuned_entity_score?: number;
  explanation: string;
  raw_snippets?: {
    google?: {
      zone_id?: string;
      zone_name?: string;
    };
  };
  feedback_tuning?: {
    original_entity_score?: number;
    original_confidence?: "strong" | "likely" | "candidate_review" | "ambiguous";
    score_delta?: number;
    explanation?: string;
  };
  shop_license?: string | null;
  shop_license_name?: string | null;
  shop_distance?: number | null;
  association_confidence?: "strong" | "likely" | "weak" | null;
  tech_count_nearby?: number;
  lat?: number | null;
  lon?: number | null;
};

type ReviewStateMap = Record<string, ReviewDecision>;
type SalonTechReviewStateMap = Record<string, SalonTechLinkReviewDecision>;

type ShopIndexRow = {
  shop_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  license_id: string;
};

type ShopIndexFile = {
  rows?: ShopIndexRow[];
};

type TechAssociationRow = {
  shop_license_id: string;
  shop_name: string;
  tech_row_id: string;
  tech_license_id: string;
  tech_name: string;
  tech_category: string;
  address_key: string;
  distance_to_shop: number;
  association_confidence: "strong" | "likely" | "weak";
  city?: string;
  zip?: string;
  license_type?: string;
  tech_lat?: number | null;
  tech_lon?: number | null;
};

type TechAssociationsFile = {
  rows?: TechAssociationRow[];
};

function loadShopIndex(): ShopIndexRow[] {
  const filePath = path.join(
    process.cwd(),
    "data",
    "co",
    "dora",
    "denver_metro",
    "dora",
    "derived",
    "dora_shop_index.v1.json"
  );
  if (!existsSync(filePath)) return [];
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as ShopIndexFile;
  return Array.isArray(parsed.rows) ? parsed.rows : [];
}

function loadTechAssociations(): TechAssociationRow[] {
  const filePath = path.join(process.cwd(), "data", "markets", "dora_shop_tech_associations.v1.json");
  if (!existsSync(filePath)) return [];
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as TechAssociationsFile;
  return Array.isArray(parsed.rows) ? parsed.rows : [];
}

export default async function LiveUnitsPage() {
  const loaded = await loadLiveUnitsWithTrace();
  const rows = loaded.rows as LiveUnitRow[];
  const loadTrace: LiveUnitsLoadTrace = {
    ...loaded.trace,
    rowsSentToClient: rows.length,
  };
  const reviewState = readReviewState().decisions;
  const salonTechReviewState = readSalonTechLinksReviewState().links;
  const shopIndex = loadShopIndex();
  const techAssociations = loadTechAssociations();

  return (
    <LiveUnitsClient
      rows={rows.map((row) => ({
        ...row,
        entity_id: row.entity_id || row.live_unit_id,
      }))}
      loadTrace={loadTrace}
      initialReviewState={reviewState}
      initialSalonTechReviewState={salonTechReviewState}
      shopIndex={shopIndex}
      techAssociations={techAssociations}
    />
  );
}
