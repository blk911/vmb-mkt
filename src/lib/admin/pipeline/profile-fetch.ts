import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import type { ProfileObservation } from "./profile-types";

export const PROFILE_FETCH_LIMITS = { maxPages: 3, maxRedirects: 2, maxBytes: 2 * 1024 * 1024, deadlineMs: 20_000 } as const;
export interface ResolvedProfileAddress { address: string; family: number }
export interface ProfileHttpResponse { statusCode: number; headers: Record<string, string | string[] | undefined>; body: string }
export interface ProfileRequestOptions {
  url: URL;
  pinnedAddress: ResolvedProfileAddress;
  timeoutMs: number;
  maxBytes: number;
  signal: AbortSignal;
}
/** Injection is deliberately below URL/DNS policy, so tests cannot accidentally skip it. */
export interface ProfileFetchDependencies {
  now?: () => number;
  resolve?: (hostname: string) => Promise<ResolvedProfileAddress[]>;
  request?: (options: ProfileRequestOptions) => Promise<ProfileHttpResponse>;
}
export interface ProfileFetchResult {
  sourceUrl: string;
  finalUrl?: string;
  outcome: ProfileObservation["outcome"];
  httpStatus?: number;
  body?: string;
  reason: string;
}
class FetchFailure extends Error {
  constructor(readonly outcome: ProfileObservation["outcome"], message: string) { super(message); }
}
const socialHosts = ["instagram.com", "facebook.com", "fb.com", "fb.me", "tiktok.com", "linkedin.com", "twitter.com", "x.com", "youtube.com", "youtu.be", "pinterest.com", "threads.net", "threads.com", "snapchat.com"];
export function isSocialProfileHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return socialHosts.some((root) => host === root || host.endsWith(`.${root}`));
}
function ipv6Words(address: string): number[] | undefined {
  if (address.includes("%") || address.includes(".")) return undefined;
  const parts = address.toLowerCase().split("::");
  if (parts.length > 2) return undefined;
  const left = parts[0] ? parts[0].split(":") : [];
  const right = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((parts.length === 1 && missing !== 0) || (parts.length === 2 && missing < 1)) return undefined;
  const words = [...left, ...Array(parts.length === 2 ? missing : 0).fill("0"), ...right];
  return words.length === 8 && words.every((v) => /^[0-9a-f]{1,4}$/.test(v)) ? words.map((v) => parseInt(v, 16)) : undefined;
}
/** Conservative public-unicast allowlist. IPv4-mapped and translation/tunnel IPv6 are rejected. */
export function isPublicProfileAddress(input: string): boolean {
  const address = input.replace(/^\[|\]$/g, "");
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
  }
  if (isIP(address) !== 6) return false;
  const w = ipv6Words(address);
  if (!w || (w[0] & 0xe000) !== 0x2000) return false;
  // IANA special-purpose, documentation, 6to4 and formerly reserved address space.
  return !((w[0] === 0x2001 && (w[1] <= 0x01ff || w[1] === 0x0db8)) || w[0] === 0x2002 || (w[0] === 0x3fff && w[1] <= 0x0fff));
}
export function publicProfileUrl(input: string): URL | undefined {
  if (!input || input.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(input)) return undefined;
  let url: URL;
  try { url = new URL(input); } catch { return undefined; }
  if (url.href.length > 2048 || url.protocol !== "https:" || (url.port && url.port !== "443") || url.username || url.password || url.hash) return undefined;
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || /(?:^|\.)(?:localhost|local|internal|intranet|lan|home|test|invalid|example|onion)$/.test(hostname)) return undefined;
  if (isIP(hostname)) { if (!isPublicProfileAddress(hostname)) return undefined; }
  else if (!hostname.includes(".") || !/^[a-z0-9.-]+$/.test(hostname)) return undefined;
  if ([...url.searchParams.keys()].some((key) => /^(?:access_token|auth|authorization|api[_-]?key|password|session|sessionid|token)$/i.test(key))) return undefined;
  return url;
}
function protectedPath(url: URL): boolean {
  let path: string;
  try { path = decodeURIComponent(url.pathname); } catch { return true; }
  return /(?:^|\/)(?:login|log-in|signin|sign-in|signup|sign-up|authenticate|oauth|captcha|challenge)(?:\/|$)/i.test(path);
}
const defaultResolve = (hostname: string) => lookup(hostname, { all: true, verbatim: true });
/** The validated IP is the only lookup answer the TLS socket can use. No proxy, cookie jar, or pooled socket. */
export function requestPinnedProfile(options: ProfileRequestOptions): Promise<ProfileHttpResponse> {
  return new Promise((resolve, reject) => {
    const { url, pinnedAddress, timeoutMs, maxBytes, signal } = options;
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const req = httpsRequest({
      protocol: "https:", hostname, port: 443, method: "GET", path: `${url.pathname}${url.search}`,
      servername: isIP(hostname) ? undefined : hostname, rejectUnauthorized: true, agent: false, family: pinnedAddress.family,
      lookup: (_hostname, _options, callback) => callback(null, pinnedAddress.address, pinnedAddress.family),
      signal, timeout: timeoutMs,
      headers: { Accept: "text/html,application/xhtml+xml,application/ld+json;q=0.8", "Accept-Encoding": "identity", "User-Agent": "Mktdecks-Public-Profile-Check/1.0" },
    }, (res) => {
      const statusCode = res.statusCode ?? 0;
      const headers = res.headers;
      // Never read protected/error/redirect response bodies.
      if (statusCode < 200 || statusCode >= 300) { res.destroy(); resolve({ statusCode, headers, body: "" }); return; }
      const encoding = String(headers["content-encoding"] ?? "identity").toLowerCase();
      if (encoding !== "identity") { res.destroy(); reject(new FetchFailure("unsupported", "Encoded responses are not supported.")); return; }
      const length = Number(headers["content-length"] ?? 0);
      if (Number.isFinite(length) && length > maxBytes) { res.destroy(); reject(new FetchFailure("too_large", "Response exceeds 2 MiB.")); return; }
      const chunks: Buffer[] = [];
      let bytes = 0;
      res.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > maxBytes) { res.destroy(new FetchFailure("too_large", "Response exceeds 2 MiB.")); return; }
        chunks.push(chunk);
      });
      res.on("error", reject);
      res.on("aborted", () => reject(new FetchFailure("error", "Response ended before completion.")));
      res.on("end", () => resolve({ statusCode, headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("timeout", () => req.destroy(new FetchFailure("timeout", "Public profile request timed out.")));
    req.on("error", reject);
    req.end();
  });
}
function header(response: ProfileHttpResponse, key: string): string {
  const entry = Object.entries(response.headers).find(([name]) => name.toLowerCase() === key)?.[1];
  return Array.isArray(entry) ? entry[0] ?? "" : entry ?? "";
}
async function withinDeadline<T>(work: () => Promise<T>, ms: number, controller: AbortController): Promise<T> {
  if (ms <= 0) throw new FetchFailure("timeout", "Profile refinement deadline reached.");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work(), new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new FetchFailure("timeout", "Profile refinement deadline reached.")); }, ms);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}
export async function fetchPublicProfile(sourceUrl: string, deps: ProfileFetchDependencies = {}, deadlineAt?: number): Promise<ProfileFetchResult> {
  const now = deps.now ?? Date.now;
  const deadline = deadlineAt ?? now() + PROFILE_FETCH_LIMITS.deadlineMs;
  let current = sourceUrl;
  let httpStatus: number | undefined;
  const result = (outcome: ProfileObservation["outcome"], reason: string, body?: string): ProfileFetchResult => ({ sourceUrl, finalUrl: current, outcome, httpStatus, reason, ...(body === undefined ? {} : { body }) });
  try {
    for (let redirects = 0; redirects <= PROFILE_FETCH_LIMITS.maxRedirects; redirects++) {
      const url = publicProfileUrl(current);
      if (!url) return result("unsafe", "URL is not a permitted public HTTPS profile URL.");
      const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
      if (isSocialProfileHost(hostname)) return result("unsupported", "Social account links are retained as source claims; social pages are not fetched.");
      if (/(?:^|\.)(?:google\.[a-z.]+|bing\.com|yahoo\.com|duckduckgo\.com)$/.test(hostname)) return result("unsupported", "Search and maps services are not a public-profile fallback.");
      if (hostname.startsWith("api.") || /(?:^|\/)(?:api|graphql)(?:\/|$)/i.test(url.pathname)) return result("unsupported", "API endpoints are outside public-page refinement.");
      if (protectedPath(url)) return result("blocked", "Login or challenge URL; no authentication or bypass attempted.");
      const controller = new AbortController();
      const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await withinDeadline(() => (deps.resolve ?? defaultResolve)(hostname), deadline - now(), controller);
      if (!addresses.length || addresses.length > 64 || addresses.some((a) => !isPublicProfileAddress(a.address) || isIP(a.address) !== a.family)) return result("unsafe", "DNS contains a non-public or invalid address; request blocked.");
      const response = await withinDeadline(() => (deps.request ?? requestPinnedProfile)({ url, pinnedAddress: addresses[0], timeoutMs: Math.max(1, deadline - now()), maxBytes: PROFILE_FETCH_LIMITS.maxBytes, signal: controller.signal }), deadline - now(), controller);
      httpStatus = response.statusCode;
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        if (redirects === PROFILE_FETCH_LIMITS.maxRedirects) return result("error", "Profile redirect limit reached.");
        const location = header(response, "location");
        if (!location) return result("error", "Redirect has no location.");
        try { current = new URL(location, url).href; } catch { return result("unsafe", "Redirect URL is invalid."); }
        continue;
      }
      if (response.statusCode === 401 || response.statusCode === 403 || response.statusCode === 429) return result("blocked", `Public page access blocked (HTTP ${response.statusCode}); no bypass attempted.`);
      if (response.statusCode === 404 || response.statusCode === 410) return result("unavailable", `Public profile unavailable (HTTP ${response.statusCode}).`);
      if (response.statusCode < 200 || response.statusCode >= 300) return result("error", `Public profile returned HTTP ${response.statusCode}.`);
      if (Buffer.byteLength(response.body, "utf8") > PROFILE_FETCH_LIMITS.maxBytes) return result("too_large", "Response exceeds 2 MiB.");
      const contentType = header(response, "content-type").split(";", 1)[0].trim().toLowerCase();
      if (contentType && !["text/html", "application/xhtml+xml", "application/ld+json"].includes(contentType)) return result("unsupported", "Response is not a supported public HTML/JSON-LD profile page.");
      const head = response.body;
      if (/<(?:title|h1)[^>]*>[^<]*(?:access denied|verify (?:you are|you're) human|captcha|just a moment|sign in|log in)/i.test(head) || /(?:cf-chl-|challenge-platform|g-recaptcha|h-captcha|(?:name|type)\s*=\s*["']?password(?:["'\s>]))/i.test(head)) return result("blocked", "Page requires login or an access challenge; no bypass attempted.");
      return result("retrieved", "Public page retrieved.", response.body);
    }
    return result("error", "Profile redirect limit reached.");
  } catch (error) {
    if (error instanceof FetchFailure) return result(error.outcome, error.message);
    if (error instanceof Error && (error.name === "AbortError" || /timeout|timed out|ETIMEDOUT/i.test(error.message))) return result("timeout", "Public profile request timed out.");
    return result("error", "Public profile request failed; no alternate access attempted.");
  }
}
