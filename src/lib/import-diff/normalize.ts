function normalizeText(value?: string | null): string {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[|/,_\-]+/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeBusinessName(value?: string | null): string {
  return normalizeText(value)
    .replace(/\b(llc|inc|ltd|co|company|corp|corporation|pllc)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeBusinessNameTokens(value?: string | null): string[] {
  const genericWords = new Set(["the", "and", "salon", "studio", "spa", "beauty", "hair", "nails", "barber", "shop"]);
  return normalizeBusinessName(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token && !genericWords.has(token));
}

export function extractUrlDomain(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return undefined;
  }
}

export function normalizeInstagramHandle(value?: string | null): string | undefined {
  const raw = String(value || "").trim();
  if (!raw) return undefined;
  const direct = raw.replace(/^@/, "").trim();
  if (/^[a-z0-9._]+$/i.test(direct) && !direct.includes("/")) {
    return direct.toLowerCase();
  }
  try {
    const url = new URL(raw);
    if (!/instagram\.com$/i.test(url.hostname.replace(/^www\./, ""))) return undefined;
    const handle = url.pathname.split("/").filter(Boolean)[0];
    return handle ? handle.replace(/^@/, "").toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

export function normalizePhone(value?: string | null): string | undefined {
  const digits = String(value || "").replace(/\D+/g, "");
  if (!digits) return undefined;
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function normalizeAddress(value?: string | null): string | undefined {
  const normalized = normalizeText(value);
  return normalized || undefined;
}
