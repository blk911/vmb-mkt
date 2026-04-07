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

function sourceUrlCandidates(operator: ResolverOperator): string[] {
  const urls = operator.sources
    .filter((row) => row.source === "directory" || row.source === "container" || row.evidenceType === "directory_listing")
    .map((row) => row.sourceUrl)
    .filter((x): x is string => Boolean(x && x.startsWith("http")));
  return [...new Set(urls)].slice(0, 3);
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

  for (const sourceUrl of urls) {
    const fetched = await fetchCandidatePage(sourceUrl);
    if (!fetched.statusCode || !fetched.html) continue;
    scannedUrls.push(sourceUrl);
    const extracted = extractFromPage(fetched.finalUrl || sourceUrl, fetched.html, {
      source: "directory",
      sourceUrl,
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
    const links = toFollowOnLinks(sourceUrl, extracted.internalDetailLinks || []);
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

