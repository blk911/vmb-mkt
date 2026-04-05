import type { SocialPlatform } from "@/types/social-target";

/** Hostnames allowed for server-side verification fetches (SSRF guard). */
export const VERIFICATION_ALLOWED_HOSTS = new Set([
  "www.instagram.com",
  "instagram.com",
  "www.tiktok.com",
  "tiktok.com",
  "linktr.ee",
  "www.linktr.ee",
]);

export function detectPlatformFromUrl(url: string): SocialPlatform {
  const u = url.toLowerCase();
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("linktr.ee") || u.includes("linktree")) return "linktree";
  if (u.includes("instagram.com")) return "instagram";
  if (/booksy\.com|squareup\.com|fresha\.com|vagaro\.com|thecut\.co/i.test(u)) return "booking";
  if (/^https?:\/\//i.test(url.trim())) return "website";
  return "unknown";
}

/**
 * Returns a fetchable https URL only if host is allowlisted.
 */
export function normalizeSocialUrl(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  try {
    const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    const u = new URL(withProto);
    if (!VERIFICATION_ALLOWED_HOSTS.has(u.hostname.toLowerCase())) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function extractHandle(platform: SocialPlatform, url: string): string | undefined {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const path = u.pathname.replace(/\/+$/, "");
    const parts = path.split("/").filter(Boolean);
    if (platform === "instagram" && parts[0]) return parts[0].replace(/^@/, "");
    if (platform === "tiktok" && parts[0]) {
      const p = parts[0] === "@" && parts[1] ? parts[1] : parts[0].replace(/^@/, "");
      return p || undefined;
    }
    if (platform === "linktree" && parts[0]) return parts[0];
    return undefined;
  } catch {
    return undefined;
  }
}

export function buildCanonicalProfileUrl(platform: SocialPlatform, handle: string): string | undefined {
  const h = handle.replace(/^@/, "").trim();
  if (!h) return undefined;
  switch (platform) {
    case "instagram":
      return `https://www.instagram.com/${encodeURIComponent(h)}/`;
    case "tiktok":
      return `https://www.tiktok.com/@${encodeURIComponent(h)}`;
    case "linktree":
      return `https://linktr.ee/${encodeURIComponent(h)}`;
    default:
      return undefined;
  }
}
