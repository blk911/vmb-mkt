import { runGoogleSearch } from "../social-targets/operator-harvest/query-executor";
import type { SourceRecord } from "./types";

const BOOKING_DOMAINS = ["glossgenius.com", "styleseat.com", "vagaro.com", "booksy.com"];

export async function ingestBookingFromGoogle(query: string): Promise<SourceRecord[]> {
  const results: SourceRecord[] = [];
  const googleResults = await runGoogleSearch(query);
  for (const r of googleResults) {
    const url: string = r.link || "";
    if (!BOOKING_DOMAINS.some((d) => url.includes(d))) continue;
    results.push({
      name: extractNameFromBooking(url),
      city: extractCityFromQuery(query),
      booking: url,
      source: "booking",
    });
  }
  return results;
}

function extractNameFromBooking(url: string): string {
  const parts = url.split("/");
  return parts[3] || "unknown";
}

function extractCityFromQuery(query: string): string {
  const parts = query.split(" ");
  return parts[parts.length - 1] || "";
}
