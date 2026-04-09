import type { SourceRecord } from "@/lib/operators/types";
import { extractFromPage } from "@/lib/operators/page-extract";
import { fetchCandidatePage } from "@/lib/operators/page-fetch";
import type { ResolverOperator } from "./types";

export type TraversalFollowOn = {
  url: string;
  fromUrl: string;
  evidenceType?: SourceRecord["evidenceType"];
};

export type DirectoryTraversalResult = {
  followOn: TraversalFollowOn[];
  scannedUrls: string[];
  yieldedDirectDetailPages: boolean;
};

const DETAIL_PATH_HINT = /(profile|provider|professional|staff|artist|detail|book|booking|service|team|tenant|member|technician)/i;

function isDetailLikeUrl(url: string): boolean {
  return DETAIL_PATH_HINT.test(url);
}

function sourceUrlCandidates(operator: ResolverOperator): TraversalFollowOn[] {
  const rows = operator.sources
    .filter((row) => row.source === "directory" || row.source === "container" || row.evidenceType === "directory_listing")
    .map((row) => ({
      url: row.sourceUrl,
      fromUrl: row.sourceUrl,
      evidenceType: row.evidenceType,
    }))
    .filter((row): row is TraversalFollowOn => Boolean(row.url && row.url.startsWith("http")));

  const directDetail = rows
    .filter((row) => isDetailLikeUrl(row.url))
    .map((row) => ({ ...row, evidenceType: "direct_operator" as const }));
  const listingPages = rows.filter((row) => !isDetailLikeUrl(row.url));
  const deduped = [...directDetail, ...listingPages];
  const seen = new Set<string>();
  const out: TraversalFollowOn[] = [];
  for (const row of deduped) {
    if (seen.has(row.url)) continue;
    seen.add(row.url);
    out.push(row);
    if (out.length >= 6) break;
  }
  return out;
}

function toFollowOnLinks(originUrl: string, links: string[]): TraversalFollowOn[] {
  return links
    .filter((url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    })
    .filter((url) => DETAIL_PATH_HINT.test(url))
    .map((url) => ({
      url,
      fromUrl: originUrl,
      evidenceType: "direct_operator",
    }));
}

export async function traverseDirectoryForOperator(operator: ResolverOperator): Promise<DirectoryTraversalResult> {
  const followOn: TraversalFollowOn[] = [];
  const scannedUrls: string[] = [];
  let yieldedDirectDetailPages = false;
  const urls = sourceUrlCandidates(operator);

  for (const source of urls) {
    if (isDetailLikeUrl(source.url)) {
      yieldedDirectDetailPages = true;
      followOn.push({
        url: source.url,
        fromUrl: source.fromUrl,
        evidenceType: "direct_operator",
      });
      continue;
    }

    const fetched = await fetchCandidatePage(source.url);
    if (!fetched.statusCode || !fetched.html) continue;
    scannedUrls.push(source.url);
    const extracted = extractFromPage(fetched.finalUrl || source.url, fetched.html, {
      source: "directory",
      sourceUrl: source.url,
      name: operator.canonicalName,
      city: operator.canonicalCity,
      address: operator.canonicalAddress,
      phone: operator.canonicalPhone,
      website: operator.canonicalWebsite,
      booking: operator.canonicalBooking,
      instagram: operator.canonicalInstagram,
      evidenceType: "directory_listing",
      parentContainerName: operator.sources.find((row) => row.source === "container")?.parentContainerName,
    });
    const links = toFollowOnLinks(source.url, extracted.internalDetailLinks || []);
    if (links.length) yieldedDirectDetailPages = true;
    for (const row of links) followOn.push(row);
  }

  const deduped: TraversalFollowOn[] = [];
  const seen = new Set<string>();
  for (const row of followOn) {
    if (seen.has(row.url)) continue;
    seen.add(row.url);
    deduped.push(row);
    if (deduped.length >= 20) break;
  }
  return {
    followOn: deduped,
    scannedUrls,
    yieldedDirectDetailPages,
  };
}

