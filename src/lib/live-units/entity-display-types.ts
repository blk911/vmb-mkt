/**
 * Entity-first display overlay for Live Units (derived from existing row fields only).
 */

export type EntityKind = "salon" | "tech" | "mixed_business" | "unknown";

export type RelationshipHint =
  | "likely_in_salon"
  | "likely_salon_anchor"
  | "likely_suite_operator"
  | "likely_multi_tech_location"
  | "standalone_unknown"
  | "none";

export type EntryOption =
  | "salon_owner_front_desk"
  | "direct_tech"
  | "service_led_entry"
  | "mixed_service_entry"
  | "research_relationship";

export type LiveLabel = "Live Salon" | "Live Tech" | "Live Mixed" | "Unclear";

export type DerivedEntityDisplayState = {
  entityKind: EntityKind;
  liveLabel: LiveLabel;
  relationshipHint: RelationshipHint;
  entryOptions: EntryOption[];
  likelyLive: boolean;
  operatorSummary: string;
};
