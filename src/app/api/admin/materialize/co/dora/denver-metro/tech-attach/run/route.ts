import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

type AnyObj = Record<string, any>;

function absDenverRoot() {
  return path.join(process.cwd(), "data", "co", "dora", "denver_metro");
}

function readJsonAbs<T = any>(abs: string): T {
  return JSON.parse(fs.readFileSync(abs, "utf8")) as T;
}

function mkdirp(dirAbs: string) {
  fs.mkdirSync(dirAbs, { recursive: true });
}

function writeAtomicJson(abs: string, obj: any) {
  mkdirp(path.dirname(abs));
  const tmp = abs + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  fs.renameSync(tmp, abs);
}

function s(v: any): string {
  if (v == null) return "";
  return String(v).trim();
}

function getRows(raw: any): AnyObj[] {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.rows)) return raw.rows;
  return [];
}

function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function byRollupMeta(rollup: AnyObj) {
  return {
    rollupKey: s(rollup.rollupKey),
    primaryVertical: s(rollup.primaryVertical) || "UNKNOWN",
    segment: s(rollup.segment) || "UNKNOWN",
    sizeBand: s(rollup.sizeBand) || "UNKNOWN",
    attachedTechCount: safeNum(rollup.attachedTechCount || rollup.laborDensityScore),
    regCount: safeNum(rollup.regCount),
  };
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const mode = s(url.searchParams.get("mode")).toLowerCase();
    const fastMode = mode === "fast";
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Math.max(1, Math.min(200_000, Number(limitRaw))) : undefined;

    // Optional: in fast mode you can choose to NOT write the full file
    // (useful when iterating). Default: write.
    const write = url.searchParams.get("write") !== "0";

    const updatedAt = new Date().toISOString();
    const root = absDenverRoot();

    const techIndexAbs = path.join(root, "tech", "index.json");
    const rollupAbs = path.join(root, "tables", "vmb_address_rollup.json");

    if (!fs.existsSync(techIndexAbs)) {
      return NextResponse.json(
        { ok: false, error: "missing tech index", tried: [techIndexAbs] },
        { status: 400 }
      );
    }
    if (!fs.existsSync(rollupAbs)) {
      return NextResponse.json(
        { ok: false, error: "missing rollups", tried: [rollupAbs] },
        { status: 400 }
      );
    }

    const techRaw = readJsonAbs<any>(techIndexAbs);
    const techRowsAll = getRows(techRaw);
    const techRows = limit != null ? techRowsAll.slice(0, limit) : techRowsAll;

    const rollups = readJsonAbs<any[]>(rollupAbs);

    // Build licenseNumber -> rollupKeys[] map by scanning rollups.regLicenseNumbers
    const rollupsByLicense: Record<string, string[]> = Object.create(null);
    const rollupMetaByKey: Record<string, AnyObj> = Object.create(null);

    for (const r of rollups) {
      const rollupKey = s(r.rollupKey);
      if (!rollupKey) continue;

      rollupMetaByKey[rollupKey] = byRollupMeta(r);

      const nums = Array.isArray(r.regLicenseNumbers) ? r.regLicenseNumbers : [];
      for (const ln of nums) {
        const lic = s(ln);
        if (!lic) continue;
        (rollupsByLicense[lic] ||= []).push(rollupKey);
      }
    }

    // De-dupe rollup lists per license
    for (const lic of Object.keys(rollupsByLicense)) {
      const uniq = Array.from(new Set(rollupsByLicense[lic]));
      uniq.sort((a, b) => a.localeCompare(b));
      rollupsByLicense[lic] = uniq;
    }

    let techsUpdated = 0;
    let withAnySalon = 0;
    let multiSalon = 0;
    let mobilityCount = 0;
    let maxSalonCount = 0;

    const updatedRows = techRows.map((row) => {
      const licenseNumber = s(row.licenseNumber);

      // HOME rollup from tech's address/areaKey
      const homeRollupKey = s(row.rollupKey || row.areaKey || row.homeRollupKey);

      // SALON rollups from registrations
      const salonRollupKeys = licenseNumber ? (rollupsByLicense[licenseNumber] || []) : [];

      const salons = salonRollupKeys
        .map((k) => rollupMetaByKey[k] || { rollupKey: k })
        .sort((a, b) => {
          const d = safeNum(b.attachedTechCount) - safeNum(a.attachedTechCount);
          if (d !== 0) return d;
          return s(a.rollupKey).localeCompare(s(b.rollupKey));
        });

      const salonCount = salons.length;
      const multiSalonFlag = salonCount > 1;
      const primaryRollupKey = salonCount ? s(salons[0].rollupKey) : "";

      // Mobility = home rollup differs from primary salon rollup (or exists when no salon rollup)
      const mobilityFlag = Boolean(
        homeRollupKey && primaryRollupKey && homeRollupKey !== primaryRollupKey
      );

      // All rollups footprint (unique)
      const allRollups = Array.from(
        new Set([homeRollupKey, ...salonRollupKeys].filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));

      const rollupCount = allRollups.length;

      if (salonCount > 0) withAnySalon++;
      if (multiSalonFlag) multiSalon++;
      if (mobilityFlag) mobilityCount++;
      if (salonCount > maxSalonCount) maxSalonCount = salonCount;

      techsUpdated++;

      return {
        ...row,
        homeRollupKey,
        salons,
        salonCount,
        multiSalonFlag,
        primaryRollupKey,
        mobilityFlag,
        rollupCount,
        // keep a lightweight footprint for UI filters/drilldowns
        rollups: allRollups,
      };
    });

    // If we sliced for fast mode, we still want to preserve full file shape.
    // Default: update only the first N rows (fast), keep the rest as-is.
    let rowsOut: AnyObj[] = techRowsAll;
    if (limit != null) {
      rowsOut = [...techRowsAll];
      for (let i = 0; i < updatedRows.length; i++) rowsOut[i] = updatedRows[i];
    } else {
      rowsOut = updatedRows;
    }

    const outObj = {
      ok: true,
      updatedAt,
      // preserve original counts if they exist, but add attach stats
      counts: {
        ...(techRaw?.counts || {}),
        techsUpdated,
        withAnySalon,
        multiSalon,
        mobilityCount,
        maxSalonCount,
      },
      rows: rowsOut,
    };

    if (write) {
      writeAtomicJson(techIndexAbs, outObj);
    }

    return NextResponse.json({
      ok: true,
      rel: "data/co/dora/denver_metro/tech/index.json",
      updatedAt,
      fastMode,
      wrote: write,
      counts: { techsUpdated, withAnySalon, multiSalon, mobilityCount, maxSalonCount },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
