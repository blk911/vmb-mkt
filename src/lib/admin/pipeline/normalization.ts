import crypto from "node:crypto";

export type CanonicalCategory = "nails" | "lashes" | "brows" | "hair" | "spa" | "multi_service" | "unknown";

export type InstagramUrlIdentity = {
  normalizedUrl: string;
  instagramHandle?: string;
  instagramProfileUrl?: string;
  displayNameFallback?: string;
  identityKind: "profile" | "content";
};

export function normalizeCanonicalCategory(input?: string): CanonicalCategory {
  const text = (input || "").trim().toLowerCase();
  if (!text) return "unknown";
  const hits = [
    /(nail|gel x|acrylic|manicure|pedicure)/.test(text) ? "nails" : null,
    /(lash|extension)/.test(text) ? "lashes" : null,
    /(brow|microblad)/.test(text) ? "brows" : null,
    /(hair|stylist|colorist|barber|blowout)/.test(text) ? "hair" : null,
    /(spa|facial|massage|wax|esthetic)/.test(text) ? "spa" : null,
  ].filter(Boolean) as CanonicalCategory[];

  if (!hits.length) return "unknown";
  return new Set(hits).size > 1 ? "multi_service" : hits[0];
}

export function toInstagramProfileUrl(value?: string): string | undefined {
  const raw = (value || "").trim();
  if (!raw) return undefined;
  if (/instagram\.com/i.test(raw)) return raw;
  const handle = raw.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/+$/, "");
  if (!handle || /[/?#]/.test(handle)) return undefined;
  return `https://www.instagram.com/${handle}/`;
}

export function instagramHandleToDisplayName(value?: string): string | undefined {
  const handle = (value || "").trim().replace(/^@/, "");
  if (!handle) return undefined;
  const display = handle.replace(/[._]+/g, " ").trim();
  return display || handle;
}

export function parseInstagramUrlIdentity(value?: string): InstagramUrlIdentity | null {
  const raw = (value || "").trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname !== "instagram.com" && hostname !== "www.instagram.com") return null;

  const segments = url.pathname.split("/").map((segment) => segment.trim()).filter(Boolean);
  const reservedRoots = new Set([
    "p",
    "reel",
    "reels",
    "tv",
    "stories",
    "explore",
    "accounts",
    "developer",
    "directory",
    "about",
    "legal",
    "policies",
  ]);
  const normalizedUrl = `https://www.instagram.com${url.pathname}${url.search}`.replace(/(?<!:)\/{2,}/g, "/");

  if (!segments.length || reservedRoots.has(segments[0].toLowerCase())) {
    return {
      normalizedUrl,
      identityKind: "content",
    };
  }

  const handle = segments[0].replace(/^@/, "");
  if (!/^[a-z0-9._]{1,30}$/i.test(handle)) {
    return {
      normalizedUrl,
      identityKind: "content",
    };
  }

  return {
    normalizedUrl,
    instagramHandle: handle,
    instagramProfileUrl: `https://www.instagram.com/${handle}/`,
    displayNameFallback: instagramHandleToDisplayName(handle),
    identityKind: "profile",
  };
}

export function toCompactDisplayName(value?: string): string | undefined {
  const text = (value || "").trim();
  return text || undefined;
}

export function pickMostCommonNonEmpty(values: Array<string | undefined>): string | undefined {
  const counts = new Map<string, number>();
  for (const value of values.map((entry) => (entry || "").trim()).filter(Boolean)) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

export function normalizedTextFingerprint(parts: string[]): string {
  const normalized = parts
    .map((part) => part.trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
  return crypto.createHash("sha1").update(normalized).digest("hex");
}
