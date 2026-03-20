const STOP_WORDS = [
  "llc",
  "inc",
  "ltd",
  "co",
  "denver",
  "downtown",
  "salon",
  "studio",
  "spa",
  "barbershop",
];

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(" ")
    .filter((w) => !STOP_WORDS.includes(w))
    .join(" ")
    .trim();
}

export function nameTokens(name: string): string[] {
  return normalizeName(name).split(" ").filter(Boolean);
}

export function normalizeAddress(addr?: string): string {
  if (!addr) return "";
  return addr.toLowerCase().replace(/[^a-z0-9]/g, "");
}
