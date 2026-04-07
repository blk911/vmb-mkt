import { writeJsonFilePretty } from "@/lib/social-targets/json-file";
import { buildOperatorHarvestQueryPack } from "@/lib/social-targets/operator-harvest/query-generator";
import { executeHarvestQueriesLive } from "@/lib/social-targets/operator-harvest/query-executor";
import { adaptHarvestQueryResultsToProspects } from "@/lib/social-targets/operator-harvest/result-adapter";
import { ingestInstagramFromGoogle } from "@/lib/operators/ingest-instagram";
import { ingestBookingFromGoogle } from "@/lib/operators/ingest-booking";
import { runMergePipeline } from "@/lib/operators/run-merge";
import { runAcquisition } from "@/lib/operators/run-acquisition";
import { classifyPage } from "@/lib/operators/page-classifier";
import { writeOperatorQualitySummaryArtifact } from "@/lib/operators/quality-summary";
import { runGoogleSearch } from "@/lib/social-targets/operator-harvest/query-executor";
import { appendEvidence } from "@/lib/evidence/store";
import { sourceRecordsToEvidence } from "@/lib/evidence/ingest";
import { runResolver } from "@/lib/resolver/run-resolver";
import { runPromotion } from "@/lib/resolver/run-promotion";
import type { SourceRecord } from "@/lib/operators/types";
import type {
  HarvestPlatform,
  HarvestProspect,
  HarvestQueryResultSet,
  HarvestRawResult,
  OperatorHarvestRunInput,
  OperatorHarvestRunOutput,
  OperatorHarvestSummary,
} from "@/lib/social-targets/operator-harvest/types";

const RAW_ARTIFACT = "runtime-data/reports/operator-harvest-raw.json";
const PROSPECTS_ARTIFACT = "runtime-data/reports/operator-harvest-prospects.json";
const SUMMARY_ARTIFACT = "runtime-data/reports/operator-harvest-summary.json";
const TOP25_ARTIFACT = "runtime-data/reports/operator-harvest-top25.json";

const BOOKING_PLATFORMS = new Set<HarvestPlatform>(["glossgenius", "vagaro", "styleseat", "booksy", "fresha", "square"]);

function countTop(values: string[], limit = 8): Array<{ value: string; count: number }> {
  const map = new Map<string, number>();
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function isLikelyRelevantProspect(prospect: HarvestProspect, requestedGeoLabels: string[]): boolean {
  if (prospect.instagramUrl || prospect.bookingUrl) return true;
  const geoSet = new Set(requestedGeoLabels.map((g) => g.toLowerCase()));
  const hasGeo = prospect.geoHints.some((h) => geoSet.has(h.toLowerCase()));
  if (!hasGeo) return false;
  return prospect.candidateType !== "ambiguous";
}

function rankProspects(prospects: HarvestProspect[]): HarvestProspect[] {
  const score = (p: HarvestProspect): number => {
    const ig = p.instagramUrl ? 30 : 0;
    const booking = p.bookingUrl ? 25 : 0;
    const candidate = p.candidateType === "operator" ? 20 : p.candidateType === "salon" ? 8 : 0;
    const confidence = p.confidence === "high" ? 14 : p.confidence === "medium" ? 8 : 2;
    return ig + booking + candidate + confidence;
  };
  return [...prospects].sort((a, b) => score(b) - score(a));
}

function summarize(raw: HarvestQueryResultSet[], prospects: HarvestProspect[]): OperatorHarvestSummary {
  const totalRawResults = raw.reduce((sum, group) => sum + group.results.length, 0);
  const withInstagram = prospects.filter((p) => Boolean(p.instagramUrl)).length;
  const withBooking = prospects.filter((p) => Boolean(p.bookingUrl)).length;
  const dmReadyCount = prospects.filter((p) => p.dmReady).length;
  const operatorCount = prospects.filter((p) => p.candidateType === "operator").length;
  const salonCount = prospects.filter((p) => p.candidateType === "salon").length;
  const ambiguousCount = prospects.filter((p) => p.candidateType === "ambiguous").length;
  const topGeoHints = countTop(prospects.flatMap((p) => p.geoHints));
  const topServiceHints = countTop(prospects.flatMap((p) => p.serviceHints));
  return {
    totalRawResults,
    totalUniqueProspects: prospects.length,
    withInstagram,
    withBooking,
    dmReadyCount,
    operatorCount,
    salonCount,
    ambiguousCount,
    topGeoHints,
    topServiceHints,
  };
}

function buildResultSetFromInput(
  input: OperatorHarvestRunInput,
  queries: OperatorHarvestRunOutput["queryPack"]["queries"]
): HarvestQueryResultSet[] {
  const byQuery = input.queryResultsByQuery ?? {};
  return queries.map((query) => {
    const rows = (byQuery[query.query] ?? []).filter(
      (x): x is HarvestRawResult =>
        Boolean(x) &&
        typeof x === "object" &&
        typeof x.title === "string" &&
        typeof x.url === "string" &&
        x.title.trim().length > 0 &&
        x.url.trim().length > 0
    );
    return { query, results: rows };
  });
}

async function buildResultSet(
  input: OperatorHarvestRunInput,
  queries: OperatorHarvestRunOutput["queryPack"]["queries"]
): Promise<HarvestQueryResultSet[]> {
  const hasInjected = Boolean(input.queryResultsByQuery && Object.keys(input.queryResultsByQuery).length > 0);
  if (hasInjected && input.useLiveIntake !== true) {
    return buildResultSetFromInput(input, queries);
  }
  return executeHarvestQueriesLive(queries, {
    resultsPerQuery: input.resultsPerQuery,
    requestDelayMs: input.requestDelayMs,
  });
}

function normalizeProspectSurface(prospect: HarvestProspect): HarvestProspect {
  const bookingPlatform = prospect.sourcePlatforms.find((p) => BOOKING_PLATFORMS.has(p));
  const primaryPlatform = prospect.instagramUrl
    ? "instagram"
    : bookingPlatform ?? prospect.primaryPlatform;
  return {
    ...prospect,
    primaryPlatform,
    dmReady: prospect.dmReady,
  };
}

function sourceRecordsFromProspects(prospects: HarvestProspect[]): SourceRecord[] {
  const out: SourceRecord[] = [];
  for (const prospect of prospects) {
    const base = {
      name: prospect.name,
      city: prospect.geoHints[0],
      category: "nails",
      address: prospect.locationLabel,
      sourceUrl: prospect.profileUrl,
    };
    out.push({
      ...base,
      source: "google",
      website:
        !prospect.instagramUrl && !prospect.bookingUrl && prospect.profileUrl.startsWith("http")
          ? prospect.profileUrl
          : undefined,
      instagram: prospect.instagramUrl,
      booking: prospect.bookingUrl,
    });
    if (prospect.instagramUrl) {
      out.push({
        ...base,
        source: "instagram",
        instagram: prospect.instagramUrl,
      });
    }
    if (prospect.bookingUrl) {
      out.push({
        ...base,
        source: "booking",
        booking: prospect.bookingUrl,
      });
    }
  }
  return out;
}

function sourceRecordsFromRawResults(resultSet: HarvestQueryResultSet[]): SourceRecord[] {
  const out: SourceRecord[] = [];
  for (const group of resultSet) {
    for (const row of group.results) {
      const url = row.url || "";
      if (!url.startsWith("http")) continue;
      const pageType = classifyPage(url);
      const source: SourceRecord["source"] =
        pageType === "suite_container" ? "container" : pageType === "directory_listing" ? "directory" : "google";
      out.push({
        source,
        sourceUrl: url,
        name: row.title,
        city: group.query.geoLabel,
        website: pageType === "website" ? url : undefined,
        evidenceType:
          pageType === "direct_operator" ||
          pageType === "directory_listing" ||
          pageType === "suite_container" ||
          pageType === "social_profile"
            ? pageType
            : undefined,
      });
    }
  }
  return out;
}

function isAcquisitionCandidate(source: SourceRecord): boolean {
  if (source.source === "directory" || source.source === "container") return true;
  if (source.booking) return true;
  const pageUrl = source.sourceUrl || source.website || source.booking || source.instagram;
  if (!pageUrl) return false;
  const pageType = classifyPage(pageUrl);
  return pageType === "directory_listing" || pageType === "suite_container" || pageType === "website";
}

async function ingestDomainCandidatesFromGoogle(queries: string[]): Promise<SourceRecord[]> {
  const out: SourceRecord[] = [];
  for (const query of queries) {
    const rows = await runGoogleSearch(query, 8);
    for (const row of rows) {
      const url = row.link || "";
      if (!url.startsWith("http")) continue;
      const pageType = classifyPage(url);
      if (pageType !== "directory_listing" && pageType !== "suite_container" && pageType !== "website") continue;
      const source = pageType === "suite_container" ? "container" : pageType === "directory_listing" ? "directory" : "google";
      out.push({
        name: row.title,
        city: queryPackCityHint(query),
        category: "nails",
        website: pageType === "website" ? url : undefined,
        sourceUrl: url,
        evidenceType: pageType,
        source,
      });
    }
  }
  return out;
}

function queryPackCityHint(query: string): string | undefined {
  const lower = query.toLowerCase();
  if (lower.includes("greenwood village")) return "Greenwood Village";
  if (lower.includes("dtc")) return "DTC";
  if (lower.includes("parker")) return "Parker";
  if (lower.includes("denver")) return "Denver";
  return undefined;
}

function buildCurrentMarketDomainSeeds(): SourceRecord[] {
  return [
    {
      name: "Sola Parker Chambers",
      city: "Parker",
      category: "nails",
      source: "container",
      sourceUrl: "https://www.solasalonstudios.com/locations/parker-chambers",
      website: "https://www.solasalonstudios.com/locations/parker-chambers",
      evidenceType: "suite_container",
    },
    {
      name: "Booksy Denver Nails",
      city: "Denver",
      category: "nails",
      source: "directory",
      sourceUrl: "https://booksy.com/en-us/s/nail-salon/denver",
      website: "https://booksy.com/en-us/s/nail-salon/denver",
      evidenceType: "directory_listing",
    },
  ];
}

export async function runOperatorHarvest(input: OperatorHarvestRunInput): Promise<OperatorHarvestRunOutput> {
  const queryPack = buildOperatorHarvestQueryPack({
    category: input.category,
    geoLabels: input.geoLabels,
    maxQueries: input.maxQueries,
  });
  const resultSet = await buildResultSet(input, queryPack.queries);
  const adapted = adaptHarvestQueryResultsToProspects(resultSet).map(normalizeProspectSurface);
  const filtered = adapted.filter((p) => isLikelyRelevantProspect(p, queryPack.geoLabels));
  const ranked = rankProspects(filtered);

  const igQueries = [
    'site:instagram.com "nails denver"',
    'site:instagram.com "denver lashes"',
    'site:instagram.com "denver esthetician"',
  ];
  const bookingQueries = [
    "site:glossgenius.com denver nails",
    "site:styleseat.com denver hair",
    "site:vagaro.com denver spa",
    "site:booksy.com denver barber",
  ];
  const domainCoverageQueries = [
    "site:solasalonstudios.com parker chambers",
    "site:booksy.com parker chambers location",
    "site:vagaro.com 80108 nail salon",
    "site:fresha.com DTC nails",
    "site:booksy.com Greenwood Village nails",
    "site:solasalonstudios.com Denver nails",
  ];

  const igRecords: SourceRecord[] = [];
  for (const q of igQueries) {
    const res = await ingestInstagramFromGoogle(q);
    igRecords.push(...res);
  }
  const bookingRecords: SourceRecord[] = [];
  for (const q of bookingQueries) {
    const res = await ingestBookingFromGoogle(q);
    bookingRecords.push(...res);
  }
  const domainCoverageRecords = await ingestDomainCandidatesFromGoogle(domainCoverageQueries);
  const domainSeedRecords = buildCurrentMarketDomainSeeds();
  const rawResultRecords = sourceRecordsFromRawResults(resultSet);

  const googleSourceRecords = sourceRecordsFromProspects(ranked);
  const allSourceRecords: SourceRecord[] = [
    ...googleSourceRecords,
    ...igRecords,
    ...bookingRecords,
    ...domainCoverageRecords,
    ...domainSeedRecords,
  ];
  const acquisitionCandidates = allSourceRecords.filter(isAcquisitionCandidate);
  const acquisitionOutput = await runAcquisition(acquisitionCandidates);
  const allEvidence = sourceRecordsToEvidence([...rawResultRecords, ...allSourceRecords, ...acquisitionOutput.enrichedRecords]);
  appendEvidence(allEvidence);
  runResolver();
  if (input.runPromotion === true) {
    await runPromotion({ batchLimit: input.promotionBatchLimit });
  }
  const merged = await runMergePipeline([]);
  await writeOperatorQualitySummaryArtifact(merged);
  const summary = summarize(resultSet, ranked);

  await writeJsonFilePretty(RAW_ARTIFACT, {
    category: queryPack.category,
    geoLabels: queryPack.geoLabels,
    queryCount: queryPack.queries.length,
    generatedAt: new Date().toISOString(),
    queries: queryPack.queries,
    resultSet,
  });
  await writeJsonFilePretty(PROSPECTS_ARTIFACT, {
    category: queryPack.category,
    geoLabels: queryPack.geoLabels,
    generatedAt: new Date().toISOString(),
    prospects: ranked,
  });
  await writeJsonFilePretty(SUMMARY_ARTIFACT, {
    category: queryPack.category,
    geoLabels: queryPack.geoLabels,
    generatedAt: new Date().toISOString(),
    ...summary,
    topProspects: ranked.slice(0, 15),
  });
  await writeJsonFilePretty(TOP25_ARTIFACT, {
    category: queryPack.category,
    geoLabels: queryPack.geoLabels,
    generatedAt: new Date().toISOString(),
    topProspects: ranked.slice(0, 25),
  });

  return {
    queryPack,
    resultSet,
    prospects: ranked,
    summary,
    artifactPaths: {
      raw: RAW_ARTIFACT,
      prospects: PROSPECTS_ARTIFACT,
      summary: SUMMARY_ARTIFACT,
      top25: TOP25_ARTIFACT,
    },
  };
}
