export function normalizeName(value?: string): string {
  return (value || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(unknown|null|undefined)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAddress(value?: string): string {
  return (value || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[?#].*$/, "")
    .replace(/["']/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePhone(value?: string): string {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

export function normalizeDomain(value?: string): string {
  if (!value) return "";
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function normalizeCity(value?: string): string {
  const cleaned = (value || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/["']/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  if (cleaned === "dtc") return "DTC";
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

