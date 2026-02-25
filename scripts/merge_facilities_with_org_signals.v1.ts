import fs from "node:fs";
import path from "node:path";

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

type FacilityRow = Record<string, any>;
type OrgRow = {
  addressKey: string;
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

const CFG = {
  FAC_IN: "data/co/dora/denver_metro/tables/vmb_facilities_enriched.json",
  ORG_IN: "data/co/dora/denver_metro/derived/address_org_signals.v1.json",
  FAC_OUT: "data/co/dora/denver_metro/tables/vmb_facilities_enriched.json", // overwrite in place
};

// very small brand dictionary (expand later)
function brandIdFromText(x: string): string | null {
  const v = x.toUpperCase();
  if (v.includes("SOLA")) return "sola";
  if (v.includes("PHENIX")) return "phenix";
  if (v.includes("SALONS BY JC") || v.includes("SALONSBYJC") || v.includes("SALONS BY J C")) return "salonsbyjc";
  if (v.includes("MY SALON SUITE")) return "mysalonsuite";
  if (v.includes("IMAGE STUDIOS")) return "imagestudios";
  return null;
}

function computeCategory(r: any): "independent-tech" | "indie-salon" | "suite-cluster" | "maildrop" {
  const techCount = Number(r.techCountAtAddress ?? 0);

  if (r.isLikelyMaildrop === true) return "maildrop";
  if (techCount >= 10) return "suite-cluster";
  if (techCount === 1) return "independent-tech";
  return "indie-salon";
}

function addressJoinKeyFromAddressKey(addressKey: string) {
  return addressKey
    .toUpperCase()
    .replace(/\s*\|\s*/g, "|")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^A-Z0-9|# ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function main() {
  const fac = mustReadJson<any>(CFG.FAC_IN);
  const facRows: FacilityRow[] = Array.isArray(fac?.rows) ? fac.rows : Array.isArray(fac) ? fac : [];

  const org = mustReadJson<any>(CFG.ORG_IN);
  const orgRows: OrgRow[] = Array.isArray(org?.rows) ? org.rows : Array.isArray(org) ? org : [];

  const orgByJoinKey = new Map<string, OrgRow>();
  const orgByRawKey = new Map<string, OrgRow>();
  for (const r of orgRows) {
    if (!r?.addressKey) continue;
    orgByRawKey.set(String(r.addressKey), r);

    const jk = String((r as any).addressJoinKey ?? "");
    if (jk) orgByJoinKey.set(jk, r);
  }

  let merged = 0;
  let setCandidate = 0;
  let setBrand = 0;
  let needsConfirm = 0;

  const outRows = facRows.map((r) => {
    const hasRegName = !!s(r.businessName) && s(r.businessName) !== "Unknown";
    r.hasReg = !!hasRegName;

    const addressKey = s(r.addressKey);
    const jk = addressJoinKeyFromAddressKey(addressKey);
    const o = orgByJoinKey.get(jk) ?? orgByRawKey.get(addressKey);
    r.addressJoinKey = jk;
    if (!o) {
      r.category = computeCategory(r);
      return r;
    }

    merged++;

    // attach org signals
    r.licenseeCountAtAddress = o.licenseeCountAtAddress;
    r.activeLicenseesAtAddress = o.activeLicenseesAtAddress;
    r.expiredLicenseesAtAddress = o.expiredLicenseesAtAddress;
    r.unknownStatusAtAddress = o.unknownStatusAtAddress;
    r.activeShare = o.activeShare;

    r.topOrgName = o.topOrgName;
    r.topOrgCount = o.topOrgCount;
    r.topOrgShare = o.topOrgShare;
    r.top5OrgCandidates = o.top5OrgCandidates;

    r.isPOBox = o.isPOBox;
    r.isOfficeTowerish = o.isOfficeTowerish;
    r.isLikelyMaildrop = o.isLikelyMaildrop;

    // businessNameCandidate: only if REG name is Unknown and org signal strong enough
    if (!hasRegName && o.topOrgName && o.topOrgShare >= 0.35) {
      r.businessNameCandidate = o.topOrgName;
      r.businessNameCandidateShare = o.topOrgShare;
      setCandidate++;
    } else {
      r.businessNameCandidate = r.businessNameCandidate ?? null;
      r.businessNameCandidateShare = r.businessNameCandidateShare ?? null;
    }

    // brand hit from REG name or candidate
    const brandText = hasRegName ? s(r.businessName) : s(r.businessNameCandidate);
    const bid = brandText ? brandIdFromText(brandText) : null;
    if (bid && !r.franchiseBrandId) {
      r.franchiseBrandId = bid;
      setBrand++;
    }

    // needsConfirm: suite-signal + no reg + (weak org OR likely maildrop)
    const isSuiteSignal = s(r.bucket) === "suite-signal" || Number(r.techCountAtAddress ?? 0) >= 10;
    const regMissing = !hasRegName;
    const weakOrg = !(o.topOrgName && o.topOrgShare >= 0.35);
    const shouldConfirm = isSuiteSignal && regMissing && (weakOrg || o.isLikelyMaildrop);

    r.needsConfirm = shouldConfirm;
    r.category = computeCategory(r);
    if (shouldConfirm) needsConfirm++;

    return r;
  });

  const payload = {
    ok: true,
    updatedAt: new Date().toISOString(),
    counts: {
      facilities: outRows.length,
      mergedOrgSignals: merged,
      setBusinessNameCandidate: setCandidate,
      setBrand: setBrand,
      needsConfirm: needsConfirm,
    },
    rows: outRows,
  };

  ensureDir(CFG.FAC_OUT);
  fs.writeFileSync(path.resolve(process.cwd(), CFG.FAC_OUT), JSON.stringify(payload, null, 2), "utf8");
  console.log(`WROTE ${CFG.FAC_OUT}`);
  console.log(payload.counts);
}

main();
