export type StatusNorm = "ACTIVE" | "EXPIRED" | "INACTIVE" | "UNKNOWN";

export function normalizeStatus(input: any): StatusNorm {
  const s = String(input ?? "").trim().toUpperCase();
  if (!s) return "UNKNOWN";
  if (s === "ACTIVE" || s === "CURRENT") return "ACTIVE";
  if (s === "EXPIRED") return "EXPIRED";
  if (s === "INACTIVE" || s === "RETIRED" || s === "SUSPENDED") return "INACTIVE";
  return "UNKNOWN";
}
