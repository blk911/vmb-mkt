import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";

type AnyObj = Record<string, any>;

function s(v: any) { return String(v ?? "").trim(); }
function up(v: any) { return s(v).toUpperCase(); }
function firstNonEmpty(...vals: any[]) {
  for (const v of vals) {
    const t = s(v);
    if (t) return t;
  }
  return "";
}
function pickZip(r: AnyObj) {
  return firstNonEmpty(
    r["Mail Zip Code"],
    r["Mail Zip Code + 4"],
    r.zip,
    r.zip5
  );
}
function pick(row: AnyObj, keys: string[]) {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function mkdirp(absDir: string) {
  fssync.mkdirSync(absDir, { recursive: true });
}
function writeAtomicJson(abs: string, obj: any) {
  mkdirp(path.dirname(abs));
  const tmp = abs + ".tmp";
  fssync.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  fssync.renameSync(tmp, abs);
}
function firstExisting(pathsAbs: string[]) {
  for (const p of pathsAbs) if (fssync.existsSync(p)) return p;
  return null;
}

export async function POST() {
  try {
    const repo = process.cwd();
    const tablesDir = path.join(repo, "data", "co", "dora", "denver_metro", "tables");
    const franchiseAbs = path.join(repo, "data", "reference", "franchise-registry.json");
    const franchiseAbsFallback = path.join(repo, "backend", "data", "reference", "franchise_registry.json");
    let franchise: { brands: Array<{ brandId: string; displayName: string; aliases: string[] }> } | null = null;

    if (fssync.existsSync(franchiseAbs)) {
      franchise = JSON.parse(await fs.readFile(franchiseAbs, "utf8"));
    } else if (fssync.existsSync(franchiseAbsFallback)) {
      franchise = JSON.parse(await fs.readFile(franchiseAbsFallback, "utf8"));
    }

    const attachedCandidates = [
      path.join(tablesDir, "vmb_licensees_attached.json"),
      path.join(repo, "backend", "data", "co", "dora", "denver_metro", "tables", "vmb_licensees_attached.json"),
    ];
    const rollupCandidates = [
      path.join(tablesDir, "vmb_address_rollup.json"),
      path.join(repo, "backend", "data", "co", "dora", "denver_metro", "tables", "vmb_address_rollup.json"),
    ];

    const attachedAbs = firstExisting(attachedCandidates);
    if (!attachedAbs) {
      return NextResponse.json({ ok: false, error: "missing vmb_licensees_attached.json", tried: attachedCandidates }, { status: 400 });
    }

    const addressRollupAbs = firstExisting(rollupCandidates);
    if (!addressRollupAbs) {
      return NextResponse.json({ ok: false, error: "missing vmb_address_rollup.json", tried: rollupCandidates }, { status: 400 });
    }

    const updatedAt = new Date().toISOString();

    const attachedJson = JSON.parse(await fs.readFile(attachedAbs, "utf8"));
    const rows: AnyObj[] = Array.isArray(attachedJson?.rows) ? attachedJson.rows : Array.isArray(attachedJson) ? attachedJson : [];

    const rollupJson = JSON.parse(await fs.readFile(addressRollupAbs, "utf8"));
    const rollRows: AnyObj[] = Array.isArray(rollupJson?.rows) ? rollupJson.rows : Array.isArray(rollupJson) ? rollupJson : [];

    // addressKey -> rollupKey map
    const addrToRollup = new Map<string, string>();
    for (const r of rollRows) {
      const ak = up(r.addressKey || r.address_key);
      const rk = up(r.rollupKey || r.rollup_key);
      if (ak && rk) addrToRollup.set(ak, rk);
    }

    // rollupKey -> rollup meta (best effort)
    const rollupMeta = new Map<string, AnyObj>();
    for (const r of rollRows) {
      const rk = up(r.rollupKey || r.rollup_key);
      if (!rk) continue;

      const existing = rollupMeta.get(rk);
      const cand = {
        rollupKey: rk,
        businessName: s(r.businessName || r.business_name || ""),
        city: s(r.city || ""),
        state: s(r.state || ""),
        zip: s(r.zip5 || r.zip || ""),
        segment: s(r.segment || ""),
        sizeBand: s(r.sizeBand || r.size_band || ""),
        laborDensityBucket: s(r.laborDensityBucket || r.labor_density_bucket || ""),
        attachedTechCount: Number(r.attachedTechCount ?? r.attached_tech_count ?? 0),
        regCount: Number(r.regCount ?? r.reg_count ?? 0),
      };

      if (!existing) rollupMeta.set(rk, cand);
      else if (!existing.businessName && cand.businessName) rollupMeta.set(rk, cand);
    }

    let skippedNoAddressKey = 0;
    let missingRollupLookup = 0;

    const byKey = new Map<string, AnyObj>();

    for (const r of rows) {
      const addressKey = up(r.addressKey || r.address_key);
      if (!addressKey) { skippedNoAddressKey++; continue; }

      // ✅ THE FIX: derive rollupKey from mapping (fallback to addressKey)
      const mapped = addrToRollup.get(addressKey);
      if (!mapped) missingRollupLookup++;

      const rollupKey = up(
        r.rollupKey || r.homeRollupKey || r.areaKey || r.primaryRollupKey || mapped || addressKey
      );
      if (!rollupKey) continue; // should never happen now

      let o = byKey.get(rollupKey);
      if (!o) {
        const meta = rollupMeta.get(rollupKey);

        // Pull real-ish identity/location from ATTACHED row (raw CSV headers)
        const entityName = s(r["Entity Name"]);
        const formattedName = s(r["Formatted Name"]);
        const addr1 = s(r["Address Line 1"]);
        const addr2 = s(r["Address Line 2"]);
        const attention = s(r["Attention"]);
        const city = s(r["City"]);
        const state = s(r["State"]);
        const zip = pickZip(r);

        // Franchise detect: strict word-boundary matching to avoid false positives.
        let franchiseBrandId: string | null = null;
        let franchiseDisplayName = "";

        const hay = up(`${entityName} ${addr1} ${addr2} ${attention}`);
        const isSola =
          /\bSOLA\b/.test(hay) ||
          /\bSOLA\s+SALON\b/.test(hay) ||
          /\bSOLA\s+SALON\s+STUDIOS\b/.test(hay);
        const isPhenix =
          /\bPHENIX\b/.test(hay) ||
          /\bPHENIX\s+SALON\b/.test(hay) ||
          /\bPHENIX\s+SALON\s+SUITES\b/.test(hay);
        const isMySalonSuite =
          /\bMY\s+SALON\s+SUITE(S)?\b/.test(hay) ||
          /\bMYSALONSUITE(S)?\b/.test(hay);
        const isSalonsByJC =
          /\bSALONS\s+BY\s+JC\b/.test(hay) ||
          /\bSALON\s+BY\s+JC\b/.test(hay);

        if (isSola) franchiseBrandId = "sola";
        else if (isPhenix) franchiseBrandId = "phenix";
        else if (isMySalonSuite) franchiseBrandId = "mysalonsuite";
        else if (isSalonsByJC) franchiseBrandId = "salonsbyjc";

        if (franchiseBrandId && franchise?.brands?.length) {
          const match = franchise.brands.find((b) => b.brandId === franchiseBrandId);
          if (match?.displayName) {
            franchiseDisplayName = match.displayName;
          }
        }

        // Choose a display name:
        // 1) franchiseDisplayName if matched
        // 2) entityName if it looks like a business (not just the same as formatted person name)
        // 3) rollup meta businessName if present and not garbage
        // 4) rollupKey
        const entityLooksBusiness = !!entityName && entityName.toLowerCase() !== formattedName.toLowerCase();

        const baseName =
          franchiseDisplayName ||
          (entityLooksBusiness ? entityName : "") ||
          s(meta?.businessName) ||
          rollupKey;

        const bestCity = firstNonEmpty(city, meta?.city);
        const bestState = firstNonEmpty(state, meta?.state);
        const bestZip = firstNonEmpty(zip, meta?.zip);

        const displayName = franchiseDisplayName
          ? `${franchiseDisplayName}${bestCity ? ` — ${bestCity}${bestState ? `, ${bestState}` : ""}${bestZip ? ` ${bestZip}` : ""}` : ""}`
          : baseName;

        o = {
          rollupKey,
          displayName,
          // identity-ish
          segment: s(meta?.segment) || "SINGLE_SHOP",
          sizeBand: s(meta?.sizeBand) || "",
          laborDensityBucket: s(meta?.laborDensityBucket) || "",
          // location-ish (best effort)
          city: bestCity,
          state: bestState,
          zip: bestZip,
          // compatibility with existing UI consumers
          businessName: s(meta?.businessName) || baseName,
          name: baseName,
          franchiseBrandId,
          techCount: 0,
          _addressSet: new Set<string>(),
          sampleTechIds: [] as string[],
        };
        byKey.set(rollupKey, o);
      }

      o.techCount += 1;
      if (addressKey) o._addressSet.add(addressKey);

      if (o.sampleTechIds.length < 5) {
        const tid = s(r["License Number"]);
        if (tid) o.sampleTechIds.push(tid);
      }

      // backfill (if meta was empty)
      if (!o.city) o.city = s(r.city);
      if (!o.state) o.state = s(r.state);
      if (!o.zip) o.zip = s(r.zip);
    }

    const outRows = Array.from(byKey.values()).map((o) => {
      const addressCount = (o._addressSet as Set<string>).size;
      delete o._addressSet;
      return { ...o, addressCount };
    });

    outRows.sort((a, b) => String(a.rollupKey).localeCompare(String(b.rollupKey)));

    const outAbs = path.join(tablesDir, "vmb_facilities.json");
    writeAtomicJson(outAbs, { ok: true, updatedAt, source: path.basename(attachedAbs), rows: outRows });

    return NextResponse.json({
      ok: true,
      rel: "data/co/dora/denver_metro/tables/vmb_facilities.json",
      updatedAt,
      counts: {
        facilities: outRows.length,
        licenseesRows: rows.length,
        skippedNoAddressKey,
        missingRollupLookup,
      },
      inputs: {
        attachedAbs,
        addressRollupAbs,
        addrMapSize: addrToRollup.size,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
