import type { RuntimeTraceLogger } from "@/lib/resolver/runtime-trace";

export type FetchedPage = {
  finalUrl: string;
  statusCode: number;
  html: string;
  contentType: string;
  elapsedMs?: number;
  timedOut?: boolean;
  error?: string;
};

export type FetchCandidatePageOptions = {
  timeoutMs?: number;
  referrer?: string;
  userAgent?: string;
  traceLogger?: RuntimeTraceLogger;
  traceContext?: {
    operatorId?: string;
    operatorName?: string;
    query?: string;
    intent?: string;
    candidateStrength?: number;
  };
};

const SUPPORTED_DOMAIN_HINTS = [
  "instagram.com",
  "yelp.com",
  "glossgenius.com",
  "vagaro.com",
  "styleseat.com",
  "booksy.com",
  "fresha.com",
  "square.site",
  "phenixsalonsuites.com",
  "solasalonstudios.com",
  "mysalonsuite.com",
  "salonlofts.com",
];

function parseHttpUrl(input: string): URL | undefined {
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function hostIsSupported(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (SUPPORTED_DOMAIN_HINTS.some((d) => host === d || host.endsWith(`.${d}`))) return true;
  return !host.includes("google.");
}

function normalizeFetchOptions(input?: number | FetchCandidatePageOptions): FetchCandidatePageOptions {
  if (typeof input === "number") return { timeoutMs: input };
  return input || {};
}

export async function fetchCandidatePage(url: string, options?: number | FetchCandidatePageOptions): Promise<FetchedPage> {
  const resolved = normalizeFetchOptions(options);
  const timeoutMs = resolved.timeoutMs ?? 12000;
  const userAgent = resolved.userAgent || "vmb-operator-acquisition/1.0";
  const startedAt = Date.now();
  const parsed = parseHttpUrl(url);
  if (!parsed || !hostIsSupported(parsed.hostname)) {
    resolved.traceLogger?.log({
      ...resolved.traceContext,
      stage: "fetch",
      status: "skipped",
      elapsedMs: Date.now() - startedAt,
      url,
      note: "unsupported_or_invalid_host",
    });
    return {
      finalUrl: url,
      statusCode: 0,
      html: "",
      contentType: "",
      elapsedMs: Date.now() - startedAt,
      error: "unsupported_or_invalid_host",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  resolved.traceLogger?.log({
    ...resolved.traceContext,
    stage: "fetch",
    status: "start",
    url: parsed.toString(),
    note: `timeoutMs=${timeoutMs}`,
  });
  try {
    const response = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": userAgent,
        accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        ...(resolved.referrer ? { referer: resolved.referrer } : {}),
      },
    });

    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("text/html") || contentType.includes("application/ld+json")
      ? (await response.text()).slice(0, 500_000)
      : "";
    const elapsedMs = Date.now() - startedAt;
    resolved.traceLogger?.log({
      ...resolved.traceContext,
      stage: "fetch",
      status: "success",
      elapsedMs,
      url: response.url || parsed.toString(),
      note: `status=${response.status}`,
    });

    return {
      finalUrl: response.url || parsed.toString(),
      statusCode: response.status,
      html: body,
      contentType,
      elapsedMs,
    };
  } catch (error: unknown) {
    const elapsedMs = Date.now() - startedAt;
    const timedOut = error instanceof Error && error.name === "AbortError";
    resolved.traceLogger?.log({
      ...resolved.traceContext,
      stage: "fetch",
      status: timedOut ? "timeout" : "error",
      elapsedMs,
      url: parsed.toString(),
      note: error instanceof Error ? error.message : "unknown_fetch_error",
    });
    return {
      finalUrl: parsed.toString(),
      statusCode: 0,
      html: "",
      contentType: "",
      elapsedMs,
      timedOut,
      error: error instanceof Error ? error.message : "unknown_fetch_error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

