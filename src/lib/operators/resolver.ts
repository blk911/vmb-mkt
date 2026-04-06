import { runGoogleSearch } from "../social-targets/operator-harvest/query-executor";
import type { OperatorRecord, SourceRecord } from "./types";

export async function resolveShelvedOperator(op: OperatorRecord): Promise<SourceRecord[]> {
  const results: SourceRecord[] = [];

  const baseQuery = `${op.name} ${op.city || ""}`.trim();
  const queries = [
    `${baseQuery} instagram`,
    `${baseQuery} booking`,
    `${baseQuery} glossgenius`,
    `${baseQuery} styleseat`,
    `${baseQuery} vagaro`,
  ];

  for (const q of queries) {
    const searchResults = await runGoogleSearch(q);

    for (const r of searchResults) {
      const url: string = r.link || "";

      if (url.includes("instagram.com")) {
        results.push({
          name: op.name,
          city: op.city,
          instagram: url,
          source: "instagram",
        });
      }

      if (url.includes("glossgenius") || url.includes("styleseat") || url.includes("vagaro") || url.includes("booksy")) {
        results.push({
          name: op.name,
          city: op.city,
          booking: url,
          source: "booking",
        });
      }
    }
  }

  return results;
}
