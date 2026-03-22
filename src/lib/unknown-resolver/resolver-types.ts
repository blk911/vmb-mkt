export type ResolverDecision = "yes" | "review" | "no";
export type ResolverRecommendation = "yes" | "review" | "no";
export type ResolverStatus = "unreviewed" | "reviewed";

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
  systemRecommendation: ResolverRecommendation | null;
  systemScore: number | null;
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

export interface UnknownResolverFiltersState {
  category: "house_cleaning";
  ring: string;
  city: string;
  systemRecommendation: "all" | ResolverRecommendation;
  operatorDecision: "all" | "undecided" | ResolverDecision;
  minScore: number;
  searchText: string;
  onlyUndecided: boolean;
}

export type EnrichedResolverRow = {
  record: UnknownResolverRecord;
  querySet: ResolverQuerySet;
  candidates: ResolverCandidate[];
  score: ResolverScoreBreakdown;
  evidenceCount: number;
};
