import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isPublicProfileAddress, requestPinnedProfile, type ProfileFetchDependencies } from "@/lib/admin/pipeline/profile-fetch";
import { buildDoraQuery, DORA_MAX_ROWS, normalizeDoraNumber, emptyDoraCheck, matchDoraRecords } from "./model";
import type { DoraCheck, DoraOfficialRow, DoraSubject } from "./types";

export const DORA_FETCH_LIMITS = { maxBytes: 256 * 1024, timeoutMs: 8_000, maxRows: DORA_MAX_ROWS, maxRedirects: 0 } as const;
/** Only this fixed anonymous government dataset is fetched. No cookies, tokens, redirects or fallback crawl. */
export async function fetchDoraCheck(subject: DoraSubject, deps: ProfileFetchDependencies = {}, deadlineAt?: number): Promise<DoraCheck> {
  const now = deps.now || Date.now, sourceUrl = buildDoraQuery(subject), attemptedAt = new Date(now()).toISOString();
  if (!sourceUrl) return { ...emptyDoraCheck("A full person name or shop name is needed for a bounded official lookup."), outcome: "insufficient_identity", attemptedAt };
  const url = new URL(sourceUrl);
  if (url.origin !== "https://data.colorado.gov" || url.pathname !== "/resource/7s5z-vewr.json") throw new Error("invalid_dora_source");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const failure = (outcome: DoraCheck["outcome"], reason: string): DoraCheck => ({ ...emptyDoraCheck(reason), outcome, attemptedAt });
  const deadline = Math.min(deadlineAt ?? Infinity, now() + DORA_FETCH_LIMITS.timeoutMs);
  if (deadline <= now()) return failure("unavailable", "Refresh time budget reached; retry later.");
  try {
    return await Promise.race([ (async (): Promise<DoraCheck> => {
      const addresses = await (deps.resolve || ((host: string) => lookup(host, { all: true, verbatim: true })))(url.hostname);
      if (!addresses.length || addresses.length > 64 || addresses.some((address) => !isPublicProfileAddress(address.address) || isIP(address.address) !== address.family)) return failure("blocked", "Official-source DNS did not resolve only to public addresses.");
      if (controller.signal.aborted || now() >= deadline) return failure("unavailable", "Official lookup timed out.");
      const response = await (deps.request || requestPinnedProfile)({ url, pinnedAddress: addresses[0], timeoutMs: Math.max(1, deadline - now()), maxBytes: DORA_FETCH_LIMITS.maxBytes, signal: controller.signal });
      if ([401, 403, 429].includes(response.statusCode)) return failure("blocked", `Official dataset blocked access (HTTP ${response.statusCode}); no bypass attempted.`);
      if (response.statusCode >= 300 && response.statusCode < 400) return failure("blocked", "Official dataset redirected; no redirect or login followed.");
      if (response.statusCode < 200 || response.statusCode >= 300) return failure("unavailable", `Official dataset unavailable (HTTP ${response.statusCode}).`);
      if (Buffer.byteLength(response.body, "utf8") > DORA_FETCH_LIMITS.maxBytes) return failure("error", "Official response exceeded the bounded size limit.");
      const header = (key: string) => { const value = Object.entries(response.headers).find(([name]) => name.toLowerCase() === key)?.[1]; return Array.isArray(value) ? value[0] : value; };
      if (!/^application\/json(?:;|$)/i.test(header("content-type") || "")) return failure("blocked", "Official source did not return JSON; no login or challenge attempted.");
      const parsed: unknown = JSON.parse(response.body);
      if (!Array.isArray(parsed) || parsed.some((row) => !row || typeof row !== "object" || Array.isArray(row))) return failure("error", "Official source returned an unexpected data shape.");
      // Reject malformed fields rather than interpreting partial/unknown records as a clean no-match.
      const fields = ["firstname", "middlename", "lastname", "suffix", "entityname", "licensetype", "licensenumber", "licensestatusdescription", "city", "state", "mailzipcode", "licenseexpirationdate"];
      if (parsed.some((row) => !row.licensetype || !normalizeDoraNumber(row.licensenumber) || fields.some((field) => row[field] !== undefined && typeof row[field] !== "string"))) return failure("error", "Official data fields changed; review the source schema.");
      const modified = header("x-soda2-truth-last-modified") || header("last-modified");
      const datasetUpdatedAt = modified && Number.isFinite(Date.parse(modified)) ? new Date(modified).toISOString() : undefined;
      return matchDoraRecords(subject, parsed as DoraOfficialRow[], { attemptedAt, checkedAt: new Date(now()).toISOString(), datasetUpdatedAt, truncated: parsed.length > DORA_MAX_ROWS });
    })(), new Promise<DoraCheck>((resolve) => { timer = setTimeout(() => { controller.abort(); resolve(failure("unavailable", "Official lookup timed out; no alternate access attempted.")); }, Math.max(1, deadline - now())); }) ]);
  } catch { return failure("error", "Official lookup failed; no negative licensing conclusion was made."); }
  finally { if (timer) clearTimeout(timer); controller.abort(); }
}
