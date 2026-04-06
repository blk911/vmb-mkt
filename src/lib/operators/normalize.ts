export function cleanText(value?: string): string | undefined {
  if (!value) return undefined;
  return value
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCity(raw?: string): string | undefined {
  if (!raw) return undefined;
  const cleaned = cleanText(raw)?.toLowerCase();
  if (!cleaned) return undefined;
  if (cleaned.includes("denver")) return "Denver";
  if (cleaned.includes("dtc")) return "DTC";
  if (cleaned.includes("greenwood")) return "Greenwood Village";
  return cleaned;
}

export function normalizeName(raw?: string): string | undefined {
  if (!raw) return undefined;
  const cleaned = cleanText(raw);
  if (!cleaned) return undefined;
  if (cleaned.toLowerCase() === "unknown") return undefined;
  return cleaned;
}

export function isHandleLikeName(name?: string): boolean {
  if (!name) return false;
  if (!name.includes(" ") && name.length < 25) return true;
  return false;
}
