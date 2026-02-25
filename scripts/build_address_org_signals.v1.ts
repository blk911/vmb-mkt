import fs from "node:fs";
import path from "node:path";

type LicenseeRow = Record<string, any>;

function mustReadJson<T>(rel: string): T {
  const abs = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(abs)) throw new Error(`Missing file: ${rel}`);
  return JSON.parse(fs.readFileSync(abs, "utf8")) as T;
}

function ensureDir(relFile: string) {
  fs.mkdirSync(path.dirname(path.resolve(process.cwd(), relFile)), { recursive: true });
}

function s(v: any) {
  return String(v ?? "").trim();
}

function normText(x: string) {
  return x
    .toUpperCase()
    .replace(/[\u2018\u2019\u201C\u201D]/g, '"')
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9# ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normAddressLine(x: string) {
  let v = normText(x);

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
  const city = normText(parts.city);
  const state = normText(parts.state);
  const zip = normText(parts.zip ?? "");

  if (!a1 || !city || !state) return "";

  const out = [a1];
  if (a2) out.push(a2);
  out.push(city, state);
  if (zip) out.push(zip);

  return out.join(" | ");
}

function addressJoinKeyFromAddressKey(addressKey: string) {
  // Turn "14500 W COLFAX AVE UNIT 126 | LAKEWOOD | CO | 80401"
  // into a stable join key: "14500 W COLFAX AVE UNIT 126|LAKEWOOD|CO|80401"
  return addressKey
    .toUpperCase()
    .replace(/\s*\|\s*/g, "|")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^A-Z0-9|# ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normOrgName(x: string) {
  let v = normText(x);
  // remove ultra-generic noise
  v = v.replace(/\bLLC\b/g, "LLC");
  v = v.replace(/\bINC\b/g, "INC");
  v = v.replace(/\bLTD\b/g, "LTD");
  v = v.replace(/\bCORP\b/g, "CORP");
  // collapse repeated corporate suffixes
  v = v.replace(/\b(LLC)(\s+LLC)+\b/g, "LLC");
  v = v.replace(/\b(INC)(\s+INC)+\b/g, "INC");
  return v;
}

function parseDateOrNull(x: any): number | null {
  const v = String(x ?? "").trim();
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

function statusBucketFromRow(r: any): "Active" | "Expired" | "Unknown" {
  const desc = String(r?.["License Status Description"] ?? "").trim();
  const v = desc.toLowerCase();

  // --- TEXT RULES (broad) ---
  if (v) {
    // treat "inactive" as expired even though it contains "active"
    if (v.includes("inactive")) return "Expired";

    if (
      v.includes("active") ||
      v.includes("current") ||
      v.includes("valid") ||
      v.includes("good standing") ||
      v.includes("renew") ||
      v.includes("renewed") ||
      v.includes("issued") ||
      v.includes("approved") ||
      v.includes("clear")
    ) {
      return "Active";
    }

    if (
      v.includes("expire") ||
      v.includes("expired") ||
      v.includes("lapse") ||
      v.includes("lapsed") ||
      v.includes("closed") ||
      v.includes("revok") ||
      v.includes("suspend") ||
      v.includes("denied") ||
      v.includes("relinquish") ||
      v.includes("retired")
    ) {
      return "Expired";
    }
  }

  // --- DATE FALLBACK (deterministic) ---
  // If desc is unhelpful, use expiration date vs today
  const expMs = parseDateOrNull(r?.["License Expiration Date"]);
  if (expMs != null) {
    const now = Date.now();
    // If expiration is in the future (or today), treat as Active
    return expMs >= now ? "Active" : "Expired";
  }

  return "Unknown";
}

function isPOBoxText(x: string) {
  const v = normText(x);
  return v.includes("PO BOX") || v.includes("P O BOX") || v.startsWith("BOX ");
}

function isOfficeTowerish(addressKey: string) {
  const v = normText(addressKey);
  // crude but effective: big downtown tower patterns often include STE + high density
  return v.includes(" STE ") || v.includes(" FL ") || v.includes(" FLOOR ") || v.includes(" SUITE ");
}

const CFG = {
  IN_JSON: "data/co/dora/denver_metro/tables/vmb_licensees_attached.json",
  OUT_JSON: "data/co/dora/denver_metro/derived/address_org_signals.v1.json",
  TOPN: 5,
  MIN_ORG_LEN: 3,
};

type OutRow = {
  addressKey: string;
  addressJoinKey: string;
  licenseeCountAtAddress: number;

  activeLicenseesAtAddress: number;
  expiredLicenseesAtAddress: number;
  unknownStatusAtAddress: number;
  activeShare: number;

  topOrgName: string | null;
  topOrgCount: number;
  topOrgShare: number;
  top5OrgCandidates: Array<{ name: string; count: number; share: number }>;

  isPOBox: boolean;
  isOfficeTowerish: boolean;
  isLikelyMaildrop: boolean;
};

function main() {
  const data = mustReadJson<any>(CFG.IN_JSON);
  const rows: LicenseeRow[] = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
  const statusFreq = new Map<string, number>();

  const byAddress = new Map<
    string,
    {
      n: number;
      active: number;
      expired: number;
      unknown: number;
      orgCounts: Map<string, number>;
      anyPOBox: boolean;
      anyOfficeish: boolean;
      rawAddrKey: string;
      joinKey: string;
    }
  >();

  for (const r of rows) {
    const a1 = s(r["Address Line 1"]) || s(r["address1"]);
    const a2 = s(r["Address Line 2"]) || s(r["address2"]);
    const city = s(r["City"]) || s(r["city"]);
    const state = s(r["State"]) || s(r["state"]);
    const zip = s(r["Mail Zip Code"]) || s(r["zip"]);
    const addressKey = makeCanonicalAddressKey({ a1, a2, city, state, zip }) || s(r.addressKey);
    if (!addressKey) continue;
    const addressJoinKey = addressJoinKeyFromAddressKey(addressKey);

    const statusDesc = s(r["License Status Description"]);
    const k = statusDesc ? statusDesc.trim() : "(empty)";
    statusFreq.set(k, (statusFreq.get(k) ?? 0) + 1);
    const sb = statusBucketFromRow(r);

    const entity = s(r["Entity Name"]);
    const org = entity ? normOrgName(entity) : "";

    const poBox = isPOBoxText(a1) || isPOBoxText(a2) || isPOBoxText(addressKey);
    const officeish = isOfficeTowerish(addressKey);

    const cur =
      byAddress.get(addressJoinKey) ??
      {
        n: 0,
        active: 0,
        expired: 0,
        unknown: 0,
        orgCounts: new Map<string, number>(),
        anyPOBox: false,
        anyOfficeish: false,
        rawAddrKey: addressKey,
        joinKey: addressJoinKey,
      };

    cur.n += 1;
    if (sb === "Active") cur.active += 1;
    else if (sb === "Expired") cur.expired += 1;
    else cur.unknown += 1;

    if (org && org.length >= CFG.MIN_ORG_LEN) {
      cur.orgCounts.set(org, (cur.orgCounts.get(org) ?? 0) + 1);
    }

    cur.anyPOBox = cur.anyPOBox || poBox;
    cur.anyOfficeish = cur.anyOfficeish || officeish;

    byAddress.set(addressJoinKey, cur);
  }

  const outRows: OutRow[] = [];

  for (const [, v] of byAddress.entries()) {
    const total = v.n;

    // sort org candidates
    const candidates = Array.from(v.orgCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const top = candidates[0] ?? null;
    const topOrgName = top ? top.name : null;
    const topOrgCount = top ? top.count : 0;

    // shares: top org share over TOTAL licensees at address (strict)
    const topOrgShare = total > 0 ? topOrgCount / total : 0;

    const top5 = candidates.slice(0, CFG.TOPN).map((c) => ({
      name: c.name,
      count: c.count,
      share: total > 0 ? c.count / total : 0,
    }));

    const activeShare = total > 0 ? v.active / total : 0;

    // likely maildrop heuristic:
    // - PO BOX always maildrop
    // - or towerish + lots of licensees + no strong org signal
    const isLikelyMaildrop =
      v.anyPOBox ||
      (v.anyOfficeish && total >= 15 && topOrgShare < 0.2);

    outRows.push({
      addressKey: v.rawAddrKey,
      addressJoinKey: v.joinKey,
      licenseeCountAtAddress: total,
      activeLicenseesAtAddress: v.active,
      expiredLicenseesAtAddress: v.expired,
      unknownStatusAtAddress: v.unknown,
      activeShare: Number(activeShare.toFixed(4)),
      topOrgName,
      topOrgCount,
      topOrgShare: Number(topOrgShare.toFixed(4)),
      top5OrgCandidates: top5,
      isPOBox: v.anyPOBox,
      isOfficeTowerish: v.anyOfficeish,
      isLikelyMaildrop,
    });
  }

  // deterministic sort: highest density first, then addressKey
  outRows.sort(
    (a, b) =>
      b.licenseeCountAtAddress - a.licenseeCountAtAddress ||
      b.activeLicenseesAtAddress - a.activeLicenseesAtAddress ||
      a.addressKey.localeCompare(b.addressKey)
  );

  const payload = {
    ok: true,
    updatedAt: new Date().toISOString(),
    counts: {
      addresses: outRows.length,
      topAddressCount: outRows[0]?.licenseeCountAtAddress ?? 0,
      likelyMaildrops: outRows.filter((r) => r.isLikelyMaildrop).length,
    },
    rows: outRows,
  };
  const topStatus = Array.from(statusFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([status, count]) => ({ status, count }));
  (payload as any).debug = { topLicenseStatusDescriptions: topStatus };

  ensureDir(CFG.OUT_JSON);
  fs.writeFileSync(path.resolve(process.cwd(), CFG.OUT_JSON), JSON.stringify(payload, null, 2), "utf8");
  console.log(`WROTE ${CFG.OUT_JSON}`);
  console.log(payload.counts);
}

main();
