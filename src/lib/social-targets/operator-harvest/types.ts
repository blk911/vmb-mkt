export type HarvestPlatform =
  | "instagram"
  | "glossgenius"
  | "vagaro"
  | "styleseat"
  | "booksy"
  | "fresha"
  | "square"
  | "yelp"
  | "suite_directory"
  | "other";

export type HarvestCandidateType = "operator" | "salon" | "ambiguous";

export type HarvestConfidence = "high" | "medium" | "low";

export type HarvestQueryFamily =
  | "instagram_operator"
  | "booking_operator"
  | "suite_feeder"
  | "yelp_feeder";

export type HarvestQuery = {
  query: string;
  family: HarvestQueryFamily;
  targetPlatform: HarvestPlatform;
  geoLabel: string;
  serviceHint: string;
};

export type HarvestQueryPack = {
  category: string;
  geoLabels: string[];
  queries: HarvestQuery[];
};

export type HarvestRawResult = {
  title: string;
  url: string;
  snippet?: string;
};

export type HarvestQueryResultSet = {
  query: HarvestQuery;
  results: HarvestRawResult[];
};

export type HarvestProspect = {
  id: string;
  name: string;
  handle?: string;
  primaryPlatform: HarvestPlatform;
  profileUrl: string;
  bookingUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  locationLabel?: string;
  geoHints: string[];
  serviceHints: string[];
  sourcePlatforms: HarvestPlatform[];
  sourceQueries: string[];
  candidateType: HarvestCandidateType;
  confidence: HarvestConfidence;
  dmReady: boolean;
  notes?: string;
};

export type OperatorHarvestSummary = {
  totalRawResults: number;
  totalUniqueProspects: number;
  withInstagram: number;
  withBooking: number;
  dmReadyCount: number;
  operatorCount: number;
  salonCount: number;
  ambiguousCount: number;
  topGeoHints: Array<{ value: string; count: number }>;
  topServiceHints: Array<{ value: string; count: number }>;
};

export type OperatorHarvestRunInput = {
  category?: string;
  geoLabels?: string[];
  maxQueries?: number;
  useLiveIntake?: boolean;
  resultsPerQuery?: number;
  requestDelayMs?: number;
  queryResultsByQuery?: Record<string, HarvestRawResult[]>;
  runPromotion?: boolean;
  promotionBatchLimit?: number;
};

export type OperatorHarvestRunOutput = {
  queryPack: HarvestQueryPack;
  resultSet: HarvestQueryResultSet[];
  prospects: HarvestProspect[];
  summary: OperatorHarvestSummary;
  artifactPaths: {
    raw: string;
    prospects: string;
    summary: string;
    top25?: string;
  };
};
