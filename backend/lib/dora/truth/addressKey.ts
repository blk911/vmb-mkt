import crypto from "node:crypto";

function norm(s: any) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function zip5(z: any) {
  return String(z || "").replace(/[^0-9]/g, "").slice(0, 5);
}

export function computeAddressKey(street1: any, city: any, state: any, zip: any) {
  const st1 = norm(street1);
  const c = norm(city);
  const st = norm(state || "CO");
  const z = zip5(zip);

  const raw = `${st1}|${c}|${st}|${z}`;
  const hash = crypto.createHash("sha1").update(raw).digest("hex").slice(0, 10);
  return {
    addressId: `addr_${hash}`,
    street1: st1,
    city: c,
    state: st,
    zip5: z,
    raw,
  };
}
