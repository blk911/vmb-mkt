const WEAK_SUFFIXES = /\b(llc|inc|co|company|services|service)\b/g;

/**
 * Lowercase, strip punctuation (keep spaces), & → and, collapse whitespace, trim.
 */
export function normalizeBusinessName(name: string | null): string {
  if (name == null || !name.trim()) return "";
  let s = name.toLowerCase().trim();
  s = s.replace(/&/g, " and ");
  s = s.replace(/[^\w\s]/g, " ");
  s = s.replace(WEAK_SUFFIXES, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export function safeIncludesNormalized(a: string | null, b: string | null): boolean {
  const na = normalizeBusinessName(a);
  const nb = normalizeBusinessName(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

export function compactAddress(value: string | null): string {
  if (value == null || !value.trim()) return "";
  return value.replace(/\s+/g, " ").trim();
}

/** First line or first ~40 chars, stripped, for street-ish query fragments. */
export function maybeStreetFragment(address: string | null): string {
  if (address == null || !address.trim()) return "";
  const line = address.split(/[\n,]/)[0]?.trim() ?? "";
  if (line.length <= 4) return "";
  return line.length > 48 ? line.slice(0, 45).trim() : line;
}
