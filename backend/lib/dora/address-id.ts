// backend/lib/dora/address-id.ts
import crypto from "node:crypto";

export type AddressParts = {
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
};

// Normalize for stable hashing: lower, trim, collapse whitespace, strip punctuation
function norm(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ");
}

export function computeAddressId(a: AddressParts) {
  const street = norm([a.street1 || "", a.street2 || ""].join(" "));
  const city = norm(a.city || "");
  const state = norm(a.state || "");
  const zip = norm((a.zip || "").replace(/[^0-9]/g, "").slice(0, 5));

  const key = `${street}|${city}|${state}|${zip}`.trim();
  const hash = crypto.createHash("sha1").update(key).digest("hex").slice(0, 16);
  return { addressId: `addr_${hash}`, addressKey: key };
}
