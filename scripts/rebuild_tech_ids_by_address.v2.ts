import fs from "node:fs";
import path from "node:path";

type LicenseeRow = {
  techId?: string;
  licenseNumber?: string;
  // common variants
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;

  mailingAddress1?: string;
  mailingAddress2?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingZip?: string;

  [k: string]: any;
};

function mustReadJson<T>(rel: string): T {
  const abs = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(abs)) throw new Error(`Missing file: ${rel}`);
  return JSON.parse(fs.readFileSync(abs, "utf8")) as T;
}

function ensureDir(relFile: string) {
  const abs = path.resolve(process.cwd(), relFile);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
}

function s(v: any) {
  return String(v ?? "").trim();
}

function normToken(x: string) {
  return x
    .toUpperCase()
    .replace(/[\u2018\u2019\u201C\u201D]/g, '"')
    .replace(/[^A-Z0-9# ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normAddressLine(x: string) {
  let v = normToken(x);

  // strip leading junk that survived as tokens
  v = v.replace(/^(;|\?|"|')+\s*/g, "").trim();

  // normalize common unit markers
  v = v
    .replace(/\bAPARTMENT\b/g, "APT")
    .replace(/\bSUITE\b/g, "STE")
    .replace(/\bSTE\b/g, "STE")
    .replace(/\bUNIT\b/g, "UNIT")
    .replace(/\bFLOOR\b/g, "FL")
    .replace(/\bROOM\b/g, "RM");

  // normalize "# 12" -> "#12"
  v = v.replace(/#\s+(\w+)/g, "#$1");

  return v;
}

function makeCanonicalAddressKey(parts: {
  a1: string;
  a2?: string;
  city: string;
  state: string;
  zip?: string;
}) {
  const a1 = normAddressLine(parts.a1);
  const a2 = parts.a2 ? normAddressLine(parts.a2) : "";
  const city = normToken(parts.city);
  const state = normToken(parts.state);
  const zip = normToken(parts.zip ?? "");

  if (!a1 || !city || !state) return "";

  const out = [a1];
  if (a2) out.push(a2);
  out.push(city, state);
  if (zip) out.push(zip);

  return out.join(" | ");
}

/**
 * Deterministic physical addressKey:
 * ADDRESS1 | ADDRESS2 | CITY | STATE | ZIP
 * - requires at least ADDRESS1 + CITY + STATE
 * - ZIP optional, but included when present
 */
function makeAddressKey(row: LicenseeRow): string {
  const a1 =
    s(row.address1) ||
    s(row["Address Line 1"]) ||
    s(row.mailingAddress1) ||
    s(row["addr1"]) ||
    s(row["addressLine1"]) ||
    "";

  const a2 =
    s(row.address2) ||
    s(row["Address Line 2"]) ||
    s(row.mailingAddress2) ||
    s(row["addr2"]) ||
    s(row["addressLine2"]) ||
    "";

  const city =
    s(row.city) ||
    s(row["City"]) ||
    s(row.mailingCity) ||
    s(row["town"]) ||
    "";

  const state =
    s(row.state) ||
    s(row["State"]) ||
    s(row.mailingState) ||
    s(row["st"]) ||
    "";

  const zip =
    s(row.zip) ||
    s(row["Mail Zip Code"]) ||
    s(row["Zip Code"]) ||
    s(row.mailingZip) ||
    s(row["postalCode"]) ||
    "";

  // hard requirements for "physical" facility targeting
  if (!a1 || !city || !state) return "";
  return makeCanonicalAddressKey({ a1, a2, city, state, zip });
}

function pickTechId(row: LicenseeRow): string {
  return (
    s(row.techId) ||
    s(row["License Number"]) ||
    s(row["licenseeId"]) ||
    s(row["personId"]) ||
    s(row.licenseNumber) ||
    ""
  );
}

function main() {
  const IN = "data/co/dora/denver_metro/tables/vmb_licensees_attached.json";
  const OUT = "data/co/dora/denver_metro/derived/tech_ids_by_address.v2.json";

  const data = mustReadJson<any>(IN);
  const rows: LicenseeRow[] = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];

  const map = new Map<string, string[]>();
  let skippedNoAddr = 0;
  let skippedNoTech = 0;

  for (const r of rows) {
    const techId = pickTechId(r);
    if (!techId) {
      skippedNoTech++;
      continue;
    }

    const addressKey = makeAddressKey(r);
    if (!addressKey) {
      skippedNoAddr++;
      continue;
    }

    const arr = map.get(addressKey) ?? [];
    arr.push(techId);
    map.set(addressKey, arr);
  }

  // deterministic ordering + de-dupe
  const outRows = Array.from(map.entries())
    .map(([addressKey, techIds]) => {
      const uniq = Array.from(new Set(techIds)).sort((a, b) => a.localeCompare(b));
      return { addressKey, techIds: uniq, techCountAtAddress: uniq.length };
    })
    .sort((a, b) => b.techCountAtAddress - a.techCountAtAddress || a.addressKey.localeCompare(b.addressKey));

  const payload = {
    ok: true,
    updatedAt: new Date().toISOString(),
    counts: {
      addresses: outRows.length,
      skippedNoAddr,
      skippedNoTech,
      topAddressCount: outRows[0]?.techCountAtAddress ?? 0,
    },
    rows: outRows,
  };

  ensureDir(OUT);
  fs.writeFileSync(path.resolve(process.cwd(), OUT), JSON.stringify(payload, null, 2), "utf8");
  console.log(`WROTE ${OUT}`);
  console.log(payload.counts);
}

main();
