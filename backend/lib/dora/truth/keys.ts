// backend/lib/dora/truth/keys.ts
import crypto from "node:crypto";

function norm(s: string) {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ");
}

export function normZip(z?: string) {
  const x = (z || "").replace(/[^0-9]/g, "");
  return x.slice(0, 5);
}

// This must match PATCH 3 addressId behavior if you already added it.
// If you already have computeAddressId(), import and reuse it instead.
export function computeAddressId(street1?: string, street2?: string, city?: string, state?: string, zip?: string) {
  const street = norm([street1 || "", street2 || ""].join(" "));
  const c = norm(city || "");
  const st = norm(state || "");
  const z = normZip(zip);
  const key = `${street}|${c}|${st}|${z}`;
  const hash = crypto.createHash("sha1").update(key).digest("hex").slice(0, 16);
  return { addressId: `addr_${hash}`, addressKey: key };
}

export function computeCityKey(city?: string, state?: string) {
  const key = `${norm(city || "")}|${norm(state || "co")}`.trim();
  const hash = crypto.createHash("sha1").update(key).digest("hex").slice(0, 10);
  return { cityKey: `city_${hash}`, cityLabel: `${(city || "").trim()} ${(state || "CO").toUpperCase()}`.trim() };
}
