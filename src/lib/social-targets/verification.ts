import type { SocialProfilePlatform, SocialResolveStatus } from "@/types/social-target";

export type VerifyProfileResult = {
  resolveStatus: SocialResolveStatus;
  finalUrl?: string;
  httpStatus?: number;
  checkedAt: string;
};

/** Hostnames allowed for server-side HEAD checks (SSRF guard). */
const ALLOWED_HOSTS = new Set([
  "www.instagram.com",
  "instagram.com",
  "www.tiktok.com",
  "tiktok.com",
  "linktr.ee",
  "www.linktr.ee",
]);

export function normalizeSocialUrl(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  try {
    const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    const u = new URL(withProto);
    if (!ALLOWED_HOSTS.has(u.hostname.toLowerCase())) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function detectPlatformFromUrl(url: string): SocialProfilePlatform {
  const u = url.toLowerCase();
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("linktr.ee")) return "linktree";
  if (u.includes("instagram.com")) return "instagram";
  return "website";
}

/** Classify fetch outcome without calling the network (for tests / manual pipeline). */
export function classifyHttpResult(status: number, redirected: boolean): SocialResolveStatus {
  if (status === 404 || status === 410) return "dead";
  if (status === 403 || status === 401) return "blocked";
  if (redirected && (status === 301 || status === 302 || status === 307 || status === 308)) return "redirect";
  if (status >= 200 && status < 400) return "live";
  if (status >= 500) return "unknown";
  return "unknown";
}

/**
 * Runtime-only HEAD request (call from API route, not build/SSR).
 * Short timeout; allowlisted hosts only.
 */
export async function verifyUrlHead(url: string): Promise<VerifyProfileResult> {
  const checkedAt = new Date().toISOString();
  const normalized = normalizeSocialUrl(url);
  if (!normalized) {
    return { resolveStatus: "unknown", checkedAt };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(normalized, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent": "VMB-SocialTargetsVerify/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timer);
    const redirected = res.status >= 300 && res.status < 400;
    const resolveStatus = classifyHttpResult(res.status, redirected);
    const loc = res.headers.get("location") ?? undefined;
    return {
      resolveStatus,
      httpStatus: res.status,
      finalUrl: loc,
      checkedAt,
    };
  } catch {
    clearTimeout(timer);
    return { resolveStatus: "unknown", checkedAt };
  }
}
