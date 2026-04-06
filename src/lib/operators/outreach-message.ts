import type { OperatorRecord } from "./types";

function inferCategory(op: OperatorRecord): string {
  const raw = (op.category || "").trim().toLowerCase();
  if (raw) return raw;

  const name = (op.name || "").toLowerCase();
  if (name.includes("nail")) return "nails";
  if (name.includes("lash")) return "lashes";
  if (name.includes("brow")) return "brows";
  if (name.includes("spa")) return "spa";
  if (name.includes("hair")) return "hair";
  return "beauty";
}

export function buildOutreachMessage(op: OperatorRecord): {
  subject: string;
  shortMessage: string;
  dmMessage: string;
} {
  const category = inferCategory(op);
  const firstName = op.name?.trim() || "there";

  const subject = `Partnership idea for ${firstName}`;

  const shortMessage =
    `Hi ${firstName} — I came across your ${category} business and wanted to reach out. ` +
    `We’re building VenMeBaby, a client-driven growth platform for personal care providers that helps generate prepaid service flow, referrals, and cross-promotion across beauty categories. ` +
    `I’d love to show you how it could fit your business.`;

  const dmMessage =
    `Hi ${firstName} — found your page and wanted to connect. ` +
    `We’re building VenMeBaby for beauty operators to help drive prepaid bookings, trusted client referrals, and partner cross-promo. ` +
    `You look like a strong fit. Open to a quick intro?`;

  return {
    subject,
    shortMessage,
    dmMessage,
  };
}
