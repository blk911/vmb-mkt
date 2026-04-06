import type { OperatorRecord } from "./types";

function isBadText(value?: string): boolean {
  if (!value) return true;
  const v = value.trim().toLowerCase();
  if (!v) return true;
  if (v === "unknown") return true;
  if (v.includes('"')) return true;
  return false;
}

export function getPreferredChannel(op: OperatorRecord): "instagram" | "booking" | "website" | "none" {
  if (op.canonical.instagram) return "instagram";
  if (op.canonical.booking) return "booking";
  if (op.canonical.website) return "website";
  return "none";
}

export function getOutreachEligibility(op: OperatorRecord): {
  eligible: boolean;
  reason: "ok" | "needs_identity_cleanup" | "needs_surface_validation" | "needs_geo_cleanup";
  preferredChannel: "instagram" | "booking" | "website" | "none";
} {
  const preferredChannel = getPreferredChannel(op);

  if (op.status !== "hot" || op.confidenceScore < 3 || preferredChannel === "none") {
    return {
      eligible: false,
      reason: "needs_surface_validation",
      preferredChannel,
    };
  }

  if (isBadText(op.name)) {
    return {
      eligible: false,
      reason: "needs_identity_cleanup",
      preferredChannel,
    };
  }

  if (isBadText(op.city)) {
    return {
      eligible: false,
      reason: "needs_geo_cleanup",
      preferredChannel,
    };
  }

  return {
    eligible: true,
    reason: "ok",
    preferredChannel,
  };
}
