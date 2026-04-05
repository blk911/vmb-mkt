import {
  buildCanonicalProfileUrl,
  detectPlatformFromUrl,
  normalizeSocialUrl,
} from "@/lib/social-targets/social-normalization";
import type {
  SocialActivityStatus,
  SocialCandidate,
  SocialPlatform,
  SocialResolveStatus,
} from "@/types/social-target";

export type SocialVerificationResult = {
  resolveStatus: SocialResolveStatus;
  activityStatus: SocialActivityStatus;
  checkedUrl?: string;
  finalUrl?: string;
  httpStatus?: number | null;
  evidence: string[];
  lastCheckedAt: string;
};

/** Classify HTTP outcome — blocked ≠ dead. */
export function classifyHttpResult(status: number, redirected: boolean): SocialResolveStatus {
  if (status === 404 || status === 410) return "dead";
  if (status === 403 || status === 401) return "blocked";
  if (redirected && (status === 301 || status === 302 || status === 307 || status === 308)) return "redirect";
  if (status >= 200 && status < 400) return "live";
  if (status >= 500) return "unknown";
  return "unknown";
}

async function fetchWithHeadThenGet(url: string): Promise<{ status: number; redirected: boolean; finalUrl?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  const headers = {
    "User-Agent": "VMB-SocialTargetsVerify/1.0",
    Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  };

  try {
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal,
      headers,
    });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { ...headers, Range: "bytes=0-8191" },
      });
    }
    clearTimeout(timer);
    const redirected = res.status >= 300 && res.status < 400;
    return {
      status: res.status,
      redirected,
      finalUrl: res.headers.get("location") ?? undefined,
    };
  } catch {
    clearTimeout(timer);
    return { status: 0, redirected: false };
  }
}

function resultFromFetch(
  checkedUrl: string,
  status: number,
  redirected: boolean,
  finalUrl: string | undefined,
  platform: SocialPlatform
): SocialVerificationResult {
  const lastCheckedAt = new Date().toISOString();
  const evidence: string[] = [];
  if (status === 0) {
    evidence.push("fetch failed or timed out");
    return {
      resolveStatus: "unknown",
      activityStatus: "unknown",
      checkedUrl,
      httpStatus: null,
      evidence,
      lastCheckedAt,
    };
  }
  evidence.push(`HTTP ${status}${redirected ? " (redirect)" : ""} for ${platform}`);
  const resolveStatus = classifyHttpResult(status, redirected);
  let activityStatus: SocialActivityStatus = "unknown";
  if (resolveStatus === "live") {
    activityStatus = "recent";
  }
  return {
    resolveStatus,
    activityStatus,
    checkedUrl,
    finalUrl,
    httpStatus: status,
    evidence,
    lastCheckedAt,
  };
}

export async function verifyInstagramCandidate(candidate: SocialCandidate): Promise<SocialVerificationResult> {
  const url =
    normalizeSocialUrl(candidate.url ?? "") ||
    normalizeSocialUrl(buildCanonicalProfileUrl("instagram", candidate.handle ?? "") ?? "") ||
    null;
  if (!url) {
    return {
      resolveStatus: "unknown",
      activityStatus: "unknown",
      evidence: ["no allowlisted instagram URL"],
      lastCheckedAt: new Date().toISOString(),
    };
  }
  const { status, redirected, finalUrl } = await fetchWithHeadThenGet(url);
  return resultFromFetch(url, status, redirected, finalUrl, "instagram");
}

export async function verifyTikTokCandidate(candidate: SocialCandidate): Promise<SocialVerificationResult> {
  const url =
    normalizeSocialUrl(candidate.url ?? "") ||
    normalizeSocialUrl(buildCanonicalProfileUrl("tiktok", candidate.handle ?? "") ?? "") ||
    null;
  if (!url) {
    return {
      resolveStatus: "unknown",
      activityStatus: "unknown",
      evidence: ["no allowlisted tiktok URL"],
      lastCheckedAt: new Date().toISOString(),
    };
  }
  const { status, redirected, finalUrl } = await fetchWithHeadThenGet(url);
  return resultFromFetch(url, status, redirected, finalUrl, "tiktok");
}

export async function verifyLinktreeCandidate(candidate: SocialCandidate): Promise<SocialVerificationResult> {
  const url =
    normalizeSocialUrl(candidate.url ?? "") ||
    normalizeSocialUrl(
      candidate.handle ? `https://linktr.ee/${encodeURIComponent(candidate.handle.replace(/^@/, ""))}` : ""
    ) ||
    null;
  if (!url) {
    return {
      resolveStatus: "unknown",
      activityStatus: "unknown",
      evidence: ["no allowlisted linktree URL"],
      lastCheckedAt: new Date().toISOString(),
    };
  }
  const { status, redirected, finalUrl } = await fetchWithHeadThenGet(url);
  return resultFromFetch(url, status, redirected, finalUrl, "linktree");
}

export async function verifyWebsiteCandidate(candidate: SocialCandidate): Promise<SocialVerificationResult> {
  const raw = candidate.url?.trim();
  if (!raw || !/^https?:\/\//i.test(raw)) {
    return {
      resolveStatus: "unknown",
      activityStatus: "unknown",
      evidence: ["website candidate needs absolute http(s) URL"],
      lastCheckedAt: new Date().toISOString(),
    };
  }
  const normalized = normalizeSocialUrl(raw);
  if (normalized) {
    const { status, redirected, finalUrl } = await fetchWithHeadThenGet(normalized);
    return resultFromFetch(normalized, status, redirected, finalUrl, "website");
  }
  return {
    resolveStatus: "unknown",
    activityStatus: "unknown",
    checkedUrl: raw,
    evidence: ["website host not in verification allowlist — manual check only"],
    lastCheckedAt: new Date().toISOString(),
  };
}

export async function verifySocialCandidate(candidate: SocialCandidate): Promise<SocialVerificationResult> {
  const platform = candidate.platform === "unknown" && candidate.url ? detectPlatformFromUrl(candidate.url) : candidate.platform;
  switch (platform) {
    case "instagram":
      return verifyInstagramCandidate({ ...candidate, platform: "instagram" });
    case "tiktok":
      return verifyTikTokCandidate({ ...candidate, platform: "tiktok" });
    case "linktree":
      return verifyLinktreeCandidate({ ...candidate, platform: "linktree" });
    case "website":
      return verifyWebsiteCandidate({ ...candidate, platform: "website" });
    case "booking":
      return verifyWebsiteCandidate({ ...candidate, platform: "booking" });
    default:
      return {
        resolveStatus: "unknown",
        activityStatus: "unknown",
        evidence: ["platform unknown — cannot auto-verify"],
        lastCheckedAt: new Date().toISOString(),
      };
  }
}

/** @deprecated Use verifySocialCandidate — kept for verify-profile route compatibility. */
export async function verifyUrlHead(url: string): Promise<{
  resolveStatus: SocialResolveStatus;
  finalUrl?: string;
  httpStatus?: number;
  checkedAt: string;
}> {
  const normalized = normalizeSocialUrl(url);
  const checkedAt = new Date().toISOString();
  if (!normalized) {
    return { resolveStatus: "unknown", checkedAt };
  }
  const { status, redirected, finalUrl } = await fetchWithHeadThenGet(normalized);
  const r = resultFromFetch(normalized, status, redirected, finalUrl, detectPlatformFromUrl(normalized));
  return {
    resolveStatus: r.resolveStatus,
    finalUrl: r.finalUrl,
    httpStatus: r.httpStatus ?? undefined,
    checkedAt: r.lastCheckedAt,
  };
}
