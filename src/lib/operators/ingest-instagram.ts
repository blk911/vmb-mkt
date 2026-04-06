import { runGoogleSearch } from "../social-targets/operator-harvest/query-executor";
import type { SourceRecord } from "./types";

export async function ingestInstagramFromGoogle(query: string): Promise<SourceRecord[]> {
  const results: SourceRecord[] = [];
  const googleResults = await runGoogleSearch(query);
  for (const r of googleResults) {
    const url: string = r.link || "";
    if (!url.includes("instagram.com")) continue;
    results.push({
      name: extractNameFromIG(url),
      city: extractCityFromQuery(query),
      instagram: url,
      source: "instagram",
    });
  }
  return results;
}

function extractNameFromIG(url: string): string {
  const handle = url.split("/")[3];
  if (!handle) return "unknown";
  return handle
    .replace(/[._]/g, " ")
    .replace(/\d+/g, "")
    .trim();
}

function extractCityFromQuery(query: string): string {
  const parts = query.split(" ");
  return parts[parts.length - 1] || "";
}
