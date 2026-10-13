// Browser-safe profile formatting; parsing and ID hashing remain server-side.
export function normalizeIgHandle(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return "";

  const normalized = raw
    .replace(/^@+/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/\/+$/, "")
    .replace(/\s+/g, "_")
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, "")
    .replace(/^[._]+|[._]+$/g, "");

  if (normalized) return normalized;

  return raw
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._]+/g, "")
    .replace(/^[._]+|[._]+$/g, "");
}

export function buildInstagramProfileUrl(handle: string): string | null {
  const normalizedHandle = normalizeIgHandle(handle);
  return normalizedHandle ? `https://www.instagram.com/${normalizedHandle}/` : null;
}
