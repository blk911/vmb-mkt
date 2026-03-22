export type ResolverDecision = "yes" | "review" | "no";
export type ResolverRecommendation = "yes" | "review" | "no";
export type ResolverStatus = "unreviewed" | "reviewed";

/** Logged touch / research row (session store v1). */
export type OutreachActivityType =
  | "call"
  | "text"
  | "email"
  | "dm"
  | "facebook_message"
  | "research"
  | "note"
  | "meeting"
  | "other";

export type OutreachActivityOutcome =
  | "attempted"
  | "left_message"
  | "no_answer"
  | "sent"
  | "replied"
  | "interested"
  | "not_now"
  | "closed_won"
  | "closed_lost"
  | "bad_fit"
  | "other";

export interface OutreachActivity {
  id: string;
  recordId: string;
  activityType: OutreachActivityType;
  outcome: OutreachActivityOutcome;
  note: string | null;
  createdAt: string;
  createdBy: string | null;
}

/** Downstream outreach workflow (house_cleaning v1). */
export type OutreachStatus =
  | "none"
  | "new"
  | "researching"
  | "ready"
  | "attempted"
  | "awaiting_response"
  | "follow_up_due"
  | "interested"
  | "not_now"
  | "closed_won"
  | "ignored";

export type ContactConfidence = "high" | "medium" | "low";

export type BestContactMethod = "phone" | "email" | "website" | "instagram" | "facebook" | "unknown";

export type ResolverSource =
  | "google"
  | "website"
  | "facebook"
  | "yelp"
  | "thumbtack"
  | "angi"
  | "nextdoor"
  | "other";

export interface UnknownResolverRecord {
  id: string;
  category: "house_cleaning";
  sourceName: string | null;
  normalizedName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  ring: number | null;
  distanceMiles: number | null;
  sourceType: string | null;
  sourceId: string | null;
  status: ResolverStatus;
  operatorDecision: ResolverDecision | null;
  operatorNote: string | null;
  /** Persisted snapshot from scoring engine (stable for UI / outreach). */
  systemRecommendation: ResolverRecommendation | null;
  systemScore: number | null;
  scoreReasoning: string | null;
  lastScoredAt: string | null;
  outreachStatus: OutreachStatus;
  /** Human-readable join of outreach tags; optional freeform. */
  outreachLabel: string | null;
  /** Selected segmentation chips (house_cleaning). */
  outreachTags: string[];
  pitchLabel: string | null;
  promotedAt: string | null;
  /** Contact enrichment (promoted outreach). */
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  bookingUrl: string | null;
  instagramHandle: string | null;
  facebookUrl: string | null;
  contactConfidence: ContactConfidence | null;
  bestContactMethod: BestContactMethod;
  contactSource: string | null;
  lastEnrichedAt: string | null;
  firstTouchPlan: string | null;
  phoneScript: string | null;
  dmScript: string | null;
  emailScript: string | null;
  contactReadinessScore: number | null;
  /** Target pin zones (may overlap); IDs from TARGET_ZONES. */
  zones: string[];
  /** Closest zone center among matches; null if no coords or no match. */
  primaryZone: string | null;
  /** Last outbound / logged touch (ISO). */
  lastContactAt: string | null;
  /** Scheduled follow-up (ISO). */
  nextFollowUpAt: string | null;
  lastActivityType: OutreachActivityType | null;
  lastOutcome: OutreachActivityOutcome | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResolverQuerySet {
  recordId: string;
  queries: string[];
}

export interface ResolverCandidate {
  id: string;
  recordId: string;
  source: ResolverSource;
  title: string;
  url: string | null;
  snippet: string | null;
  matchedName: string | null;
  matchedPhone: string | null;
  matchedAddress: string | null;
  evidenceType: string | null;
  confidence: number | null;
}

export interface ResolverScoreBreakdown {
  recordId: string;
  nameScore: number;
  categoryScore: number;
  geoScore: number;
  webPresenceScore: number;
  platformScore: number;
  conflictPenalty: number;
  finalScore: number;
  recommendation: ResolverRecommendation;
  reasoning: string;
}

export type ResolverZoneFilterId = "all" | string;

export interface UnknownResolverFiltersState {
  category: "house_cleaning";
  ring: string;
  city: string;
  systemRecommendation: "all" | ResolverRecommendation;
  operatorDecision: "all" | "undecided" | ResolverDecision;
  minScore: number;
  searchText: string;
  onlyUndecided: boolean;
  outreachStatus: "all" | OutreachStatus;
  promotedOnly: boolean;
  operatorYesOnly: boolean;
  /** Filter by membership in a target pin zone (any overlap). */
  zoneId: ResolverZoneFilterId;
}

export type EnrichedResolverRow = {
  record: UnknownResolverRecord;
  querySet: ResolverQuerySet;
  candidates: ResolverCandidate[];
  score: ResolverScoreBreakdown;
  evidenceCount: number;
};
