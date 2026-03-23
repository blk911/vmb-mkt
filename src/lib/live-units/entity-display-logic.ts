/**
 * Deterministic entity-first interpretation for Live Units rows.
 * Uses service signals (Step 2) plus subtype, shop/tech fields, and text heuristics.
 * Conservative: prefer "unknown" / "Unclear" when evidence conflicts or is weak.
 */
import type {
  DerivedEntityDisplayState,
  EntityKind,
  EntryOption,
  LiveLabel,
  RelationshipHint,
} from "./entity-display-types";
import type { PlatformSignalsRecord, PlatformType } from "./platform-signal-types";
import type { DerivedServiceSignals } from "./service-signal-types";
import { getZoneDisplayLabel } from "@/lib/geo/target-zones";
import { deriveServiceSignalsForRow, type ServiceSignalRowInput } from "./service-signal-logic";

export type EntityDisplayRowInput = ServiceSignalRowInput & {
  shop_license?: string | null;
  shop_license_name?: string | null;
  tech_count_nearby?: number;
  entity_score?: number;
  tuned_entity_score?: number;
  confidence?: string;
  tuned_confidence?: string;
  raw_snippets?: {
    google?: { zone_id?: string; zone_name?: string; website_domain?: string };
  };
  /** Optional — attached booking platform signals (high-confidence only). */
  platformSignals?: PlatformSignalsRecord | null;
};

function haystack(row: EntityDisplayRowInput): string {
  return [
    row.operational_category,
    row.subtype ?? "",
    row.signal_mix ?? "",
    row.name_display ?? "",
    row.explanation ?? "",
    row.shop_license_name ?? "",
  ]
    .join(" | ")
    .toLowerCase();
}

function effectiveScore(row: EntityDisplayRowInput): number {
  return typeof row.tuned_entity_score === "number" ? row.tuned_entity_score : row.entity_score ?? 0;
}

function effectiveConfidence(row: EntityDisplayRowInput): string {
  return row.tuned_confidence || row.confidence || "";
}

/**
 * "Live" = worth treating as an active outreach target (not a hard business rule).
 */
function deriveLikelyLive(row: EntityDisplayRowInput): boolean {
  const score = effectiveScore(row);
  const conf = effectiveConfidence(row);
  if (score >= 58) return true;
  if (conf === "strong" || conf === "likely") return true;
  if (row.shop_license?.trim()) return true;
  const domain = row.raw_snippets?.google?.website_domain?.trim();
  if (domain) return true;
  return false;
}

/** Personal / solo operator name heuristic: no strong business entity tokens. */
function looksLikePersonalTechBrand(hay: string, name: string): boolean {
  const n = name.toLowerCase();
  if (/\b(salon|spa|studio|lounge|nails|beauty bar|collective)\b/.test(n)) return false;
  if (/\b(llc|inc|corp)\b/.test(n)) return false;
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.length <= 4 && !hay.includes("salon")) return true;
  if (/\b(artist|technician|tech|esthetician|stylist)\b/.test(hay)) return true;
  return false;
}

function inferEntityKind(row: EntityDisplayRowInput, sig: DerivedServiceSignals, hay: string): EntityKind {
  const sub = (row.subtype || "").toLowerCase();
  const techNearby = row.tech_count_nearby ?? 0;
  const hasShop = !!row.shop_license?.trim();
  const name = row.name_display || "";

  let salonScore = 0;
  let techScore = 0;

  if (sub === "storefront") salonScore += 3;
  if (sub === "suite") techScore += 3;
  if (hasShop) salonScore += 3;
  if (row.shop_license_name) salonScore += 1;
  if (techNearby >= 2) salonScore += 2;
  if (/\b(salon|spa studio|beauty lounge|nail bar|nail salon)\b/.test(hay)) salonScore += 2;
  if (looksLikePersonalTechBrand(hay, name)) techScore += 2;
  if (techNearby === 0 && sub === "suite") techScore += 1;
  if (sig.isMultiService && /\b(lounge|collective|salon)\b/.test(hay)) salonScore += 1;

  if (salonScore >= 4 && salonScore > techScore + 1) return "salon";
  if (techScore >= 4 && techScore > salonScore + 1) return "tech";
  if (salonScore >= 2 && techScore >= 2) return "mixed_business";
  if (sig.isMultiService && (salonScore > 0 || techScore > 0)) return "mixed_business";
  if (salonScore > techScore && salonScore >= 2) return "salon";
  if (techScore > salonScore && techScore >= 2) return "tech";
  return "unknown";
}

function inferRelationshipHint(
  row: EntityDisplayRowInput,
  kind: EntityKind,
  hay: string
): RelationshipHint {
  const techNearby = row.tech_count_nearby ?? 0;
  const sub = (row.subtype || "").toLowerCase();
  const hasShop = !!row.shop_license?.trim();

  if (techNearby >= 3 && (kind === "salon" || kind === "mixed_business")) return "likely_multi_tech_location";
  if (sub === "storefront" && hasShop) return "likely_salon_anchor";
  if (sub === "suite") return "likely_suite_operator";
  if (kind === "tech" && hasShop) return "likely_in_salon";
  if (kind === "tech" && /\b(near|@|inside|located in)\b/.test(hay)) return "likely_in_salon";
  if (!hasShop && techNearby === 0 && kind === "unknown") return "standalone_unknown";
  if (kind === "unknown" && !hasShop) return "standalone_unknown";
  return "none";
}

function inferEntryOptions(
  kind: EntityKind,
  rel: RelationshipHint,
  sig: DerivedServiceSignals,
  likelyLive: boolean
): EntryOption[] {
  const out: EntryOption[] = [];
  const add = (o: EntryOption) => {
    if (!out.includes(o)) out.push(o);
  };

  if (!likelyLive) {
    add("research_relationship");
    return out;
  }

  if (kind === "salon" || kind === "mixed_business") {
    add("salon_owner_front_desk");
    if (sig.isMultiService) add("mixed_service_entry");
    else add("service_led_entry");
  }
  if (kind === "tech" || rel === "likely_suite_operator") {
    add("direct_tech");
    add("service_led_entry");
  }
  if (rel === "likely_in_salon") {
    add("salon_owner_front_desk");
    add("direct_tech");
  }
  if (rel === "likely_multi_tech_location") {
    add("salon_owner_front_desk");
    add("service_led_entry");
  }
  if (sig.isMultiService && !out.includes("mixed_service_entry")) add("mixed_service_entry");
  if (kind === "unknown" || rel === "standalone_unknown") add("research_relationship");
  if (out.length === 0) add("service_led_entry");
  return out;
}

function buildOperatorSummary(
  kind: EntityKind,
  rel: RelationshipHint,
  sig: DerivedServiceSignals,
  zoneName: string,
  likelyLive: boolean
): string {
  const z = zoneName && zoneName !== "No zone" ? ` in ${zoneName}` : "";
  const svc =
    sig.serviceSignals.length > 0
      ? `${sig.serviceSignals.join("/")} signals`
      : "unclear service mix";
  if (!likelyLive) {
    return `Limited live signal${z}; confirm identity and relationship before outreach.`;
  }
  if (kind === "salon" && sig.isMultiService) {
    return `Multi-service salon (${svc})${z}.`;
  }
  if (kind === "salon") {
    return `Salon-style location (${svc})${z}.`;
  }
  if (kind === "tech") {
    return `Likely solo or tech-forward operator (${svc})${z}; consider direct entry.`;
  }
  if (kind === "mixed_business") {
    return `Mixed beauty business (${svc})${z}; relationship may need confirmation.`;
  }
  if (rel === "likely_multi_tech_location") {
    return `Location with multiple tech signals nearby (${svc})${z}.`;
  }
  return `Target profile unclear (${svc})${z}; research before choosing an angle.`;
}

function liveLabelFrom(kind: EntityKind, likelyLive: boolean): LiveLabel {
  if (!likelyLive) return "Unclear";
  if (kind === "salon") return "Live Salon";
  if (kind === "tech") return "Live Tech";
  if (kind === "mixed_business") return "Live Mixed";
  return "Unclear";
}

const PLATFORM_ORDER: PlatformType[] = ["booksy", "fresha", "glossgenius", "vagaro"];
const PLATFORM_SHORT: Record<PlatformType, string> = {
  fresha: "Fresha",
  vagaro: "Vagaro",
  booksy: "Booksy",
  glossgenius: "GlossGenius",
};

function bookingPlatformHintFrom(signals?: PlatformSignalsRecord | null): string | null {
  if (!signals) return null;
  for (const p of PLATFORM_ORDER) {
    const s = signals[p];
    if (s?.isBookable) return `Bookable via ${PLATFORM_SHORT[p]}`;
  }
  return null;
}

export function deriveEntityDisplayStateForRow(row: EntityDisplayRowInput): DerivedEntityDisplayState {
  const sig = deriveServiceSignalsForRow(row);
  const hay = haystack(row);
  const likelyLive = deriveLikelyLive(row);
  const entityKind = inferEntityKind(row, sig, hay);
  const relationshipHint = inferRelationshipHint(row, entityKind, hay);
  const entryOptions = inferEntryOptions(entityKind, relationshipHint, sig, likelyLive);
  const zid = row.raw_snippets?.google?.zone_id;
  const zoneName = zid
    ? getZoneDisplayLabel(zid)
    : row.raw_snippets?.google?.zone_name
      ? getZoneDisplayLabel(row.raw_snippets.google.zone_name)
      : "No zone";
  const operatorSummary = buildOperatorSummary(entityKind, relationshipHint, sig, zoneName, likelyLive);
  const liveLabel = liveLabelFrom(entityKind, likelyLive);
  const bookingPlatformHint = bookingPlatformHintFrom(row.platformSignals);

  return {
    entityKind,
    liveLabel,
    relationshipHint,
    entryOptions,
    likelyLive,
    operatorSummary,
    bookingPlatformHint,
  };
}
