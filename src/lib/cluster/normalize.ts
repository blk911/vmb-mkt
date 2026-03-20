const LEGAL_STOP_WORDS = [
  "llc",
  "inc",
  "ltd",
  "co",
  "corp",
  "corporation",
  "company",
];

const GEO_STOP_WORDS = ["denver", "downtown", "colorado", "co"];

const SERVICE_STOP_WORDS = [
  "salon",
  "studio",
  "spa",
  "barbershop",
  "barber",
  "nails",
  "hair",
  "beauty",
];

function cleanText(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeName(name: string): string {
  return cleanText(name);
}

export function buildBrandCoreName(name: string): string {
  const tokens = cleanText(name)
    .split(" ")
    .filter(Boolean)
    .filter(
      (w) =>
        !LEGAL_STOP_WORDS.includes(w) &&
        !GEO_STOP_WORDS.includes(w) &&
        !SERVICE_STOP_WORDS.includes(w)
    );

  return tokens.join(" ").trim();
}

export function nameTokens(name: string): string[] {
  return cleanText(name).split(" ").filter(Boolean);
}

export function brandCoreTokens(name: string): string[] {
  return buildBrandCoreName(name).split(" ").filter(Boolean);
}

export function normalizeAddress(addr?: string): string {
  if (!addr) return "";
  return cleanText(addr)
    .replace(/\b(street)\b/g, "st")
    .replace(/\b(avenue)\b/g, "ave")
    .replace(/\b(boulevard)\b/g, "blvd")
    .replace(/\b(road)\b/g, "rd")
    .replace(/\b(suite)\b/g, "ste")
    .replace(/\b(apartment)\b/g, "apt")
    .replace(/\s+/g, "");
}

export function enrichEntityNames<T extends { name: string }>(
  entity: T
): T & {
  normalizedName: string;
  brandCoreName: string;
} {
  return {
    ...entity,
    normalizedName: normalizeName(entity.name),
    brandCoreName: buildBrandCoreName(entity.name),
  };
}
