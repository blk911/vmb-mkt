import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

// Helper: Denver Metro data root
function absDenverRoot() {
  return path.join(process.cwd(), "data", "co", "dora", "denver_metro");
}

// Helper: Read JSON file synchronously
function readJsonAbs<T>(abs: string): T {
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

// Helper: Get tech rows from index (normalize shape)
function getTechRowsFromIndex(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw?.rows && Array.isArray(raw.rows)) return raw.rows;
  return [];
}

// Helper: Safe string conversion
function s(v: any): string {
  return String(v || "").trim();
}

// Helper: Pick rollup key from tech row (for density lookup)
function pickRollupKeyFromTech(row: any): string {
  return s(row.rollupKey) || s(row.areaKey) || s(row.zip) || s(row.city) || "";
}

// Helper: Atomic JSON write
function writeAtomicJson(abs: string, obj: any) {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const tmp = abs + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  fs.renameSync(tmp, abs);
}

// Helper: Ensure directory exists
function mkdirp(abs: string) {
  fs.mkdirSync(abs, { recursive: true });
}

// Helper: Normalize log1p vs fixed cap (0-1 range)
function normLog1pCap(x: number, cap: number): number {
  if (cap <= 0) return 0;
  if (x <= 0) return 0;
  return clamp01(Math.log1p(x) / Math.log1p(cap));
}

// Helper: Clamp 0-1
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

// Helper: Clamp and round score (0-100)
function clampScore(x: number): number {
  return Math.round(Math.max(0, Math.min(100, x)));
}

// Type helper
type AnyObj = Record<string, any>;

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") || "";
    const fastMode = mode === "fast";
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : null;

    // Explainability: by default we DO NOT write per-tech explain files.
    // Optional: write ONE explain map file (NOT 140k individual files).
    const writeExplain = !fastMode && url.searchParams.get("writeExplain") === "1";

    const formulaVersion = "tech-signals.v2";
    const updatedAt = new Date().toISOString();

    // Fixed caps (deterministic, not dependent on slice)
    const salonCountCap = 6;
    const addressCountCap = 3;
    const facilityDensityCap = 2000;
    const salonStrengthCap = 5000;

    // Formula weights
    const weights = {
      demand: { network: 0.5, density: 0.5 },
      total: { demand: 0.40, density: 0.25, network: 0.20, mobility: 0.10, stability: 0.05 },
      network: { salonCount: 0.5, salonStrength: 0.3, addressCount: 0.2 },
      mobility: { flag: 0.45, rollupCount: 0.25, salonCount: 0.20, addressCount: 0.10 },
      stability: { singleSalon: 0.7, singleAddress: 0.3 },
    };

    const root = absDenverRoot();
    const techIndexAbs = path.join(root, "tech", "index.json");
    if (!fs.existsSync(techIndexAbs)) {
      return NextResponse.json(
        { ok: false, error: "missing tech index", tried: [techIndexAbs] },
        { status: 400 }
      );
    }

    const techIndexRaw = readJsonAbs<any>(techIndexAbs);
    let techRows = getTechRowsFromIndex(techIndexRaw);

    if (limit != null) techRows = techRows.slice(0, limit);

    // Density source: vmb_address_rollup.json
    const rollupAbs = path.join(root, "tables", "vmb_address_rollup.json");
    const densityByRollupKey: Record<string, number> = Object.create(null);

    if (fs.existsSync(rollupAbs)) {
      const rollups = readJsonAbs<any[]>(rollupAbs);
      for (const r of rollups) {
        const k = s(r.rollupKey);
        if (!k) continue;
        const attachedTechCount =
          Number(r.attachedTechCount) ||
          Number(r.laborDensityScore) ||
          Number(r.regCount) ||
          0;
        densityByRollupKey[k] = attachedTechCount;
      }
    }

    // First pass: compute raw inputs
    const baseInputs = techRows.map((row, idx) => {
      const techId = s(row.techId) || `row_${idx}`;

      const salonCount =
        Number(row.salonCount) ||
        (Array.isArray(row.salons) ? row.salons.length : 0) ||
        0;

      const addressCount =
        Number(row.addressCount) ||
        (Array.isArray(row.addresses) ? row.addresses.length : 0) ||
        0;

      const areaKey = pickRollupKeyFromTech(row);
      const facilityDensity = areaKey ? (densityByRollupKey[areaKey] || 0) : 0;

      // Mobility flag from tech-attach v2: homeRollupKey != primaryRollupKey
      const mobilityFlag = Boolean(row.mobilityFlag);

      // Rollup count (unique rollups = home + salon rollups)
      const rollupCount = Number(row.rollupCount ?? 1);

      // Salon strength: max attachedTechCount from salons array
      const salons = Array.isArray(row.salons) ? row.salons : [];
      let salonStrength = 0;
      if (salons.length > 0) {
        for (const salon of salons) {
          const attached = Number(salon.attachedTechCount || salon.attached_tech_count || 0);
          if (attached > salonStrength) salonStrength = attached;
        }
      }

      return {
        techId,
        areaKey,
        salonCount,
        addressCount,
        facilityDensity,
        mobilityFlag,
        rollupCount,
        salonStrength,
      };
    });

    // Second pass: score
    const outRows: AnyObj[] = [];
    const explain: { byTechId: Record<string, any> } = { byTechId: {} };
    const areaCounts = new Set<string>();
    const seenTechIds = new Set<string>();

    for (let i = 0; i < baseInputs.length; i++) {
      const inp = baseInputs[i];
      const { techId, areaKey, salonCount, addressCount, facilityDensity, mobilityFlag, rollupCount, salonStrength } = inp;

      // Hard stop: skip duplicate techIds
      if (seenTechIds.has(techId)) continue;
      seenTechIds.add(techId);

      if (areaKey) areaCounts.add(areaKey);

      // Signals (normalize vs fixed caps)
      const density01 = normLog1pCap(facilityDensity, facilityDensityCap);
      const salonCount01 = normLog1pCap(salonCount, salonCountCap);
      const addressCount01 = normLog1pCap(addressCount, addressCountCap);
      const salonStrength01 = normLog1pCap(salonStrength, salonStrengthCap);

      // Network: blend salon count + strength + addresses
      const network01 = clamp01(
        weights.network.salonCount * salonCount01 +
        weights.network.salonStrength * salonStrength01 +
        weights.network.addressCount * addressCount01
      );

      // Mobility: nuanced formula (not just flag)
      const mobilityFlag01 = mobilityFlag ? 1 : 0;
      const rollups = Math.max(1, rollupCount);
      const rollupMob01 = Math.min(1, (rollups - 1) / 3); // 1->0, 2->0.33, 3->0.66, 4+->1
      const salonsMob = Math.max(0, salonCount);
      const salonMob01 = Math.min(1, salonsMob / 3);
      const addrMob = Math.max(0, addressCount);
      const addrMob01 = Math.min(1, addrMob / 3);

      const mobility01 = clamp01(
        weights.mobility.flag * mobilityFlag01 +
        weights.mobility.rollupCount * rollupMob01 +
        weights.mobility.salonCount * salonMob01 +
        weights.mobility.addressCount * addrMob01
      );

      // Stability: 70% single salon + 30% single address
      const singleSalon = salonCount === 1 ? 1 : 0;
      const singleAddr = addressCount === 1 ? 1 : 0;
      const stability01 = clamp01(
        weights.stability.singleSalon * singleSalon +
        weights.stability.singleAddress * singleAddr
      );

      // Demand: 50% network + 50% density
      const demand01 = clamp01(
        weights.demand.network * network01 +
        weights.demand.density * density01
      );

      // Total: weighted sum (0-100)
      const total01 = clamp01(
        weights.total.demand * demand01 +
        weights.total.density * density01 +
        weights.total.network * network01 +
        weights.total.mobility * mobility01 +
        weights.total.stability * stability01
      );

      const signals = {
        demand: clampScore(demand01 * 100),
        density: clampScore(density01 * 100),
        network: clampScore(network01 * 100),
        mobility: clampScore(mobility01 * 100),
        stability: clampScore(stability01 * 100),
        totalScore: clampScore(total01 * 100),
      };

      const rowOut = {
        techId,
        rollupKey: areaKey || "",
        salonCount,
        addressCount,
        facilityDensity,
        mobilityFlag,
        rollupCount,
        salonStrength,
        signals,
      };

      outRows.push(rowOut);

      if (writeExplain) {
        (explain.byTechId as any)[techId] = {
          techId,
          inputs: {
            salonCount,
            addressCount,
            facilityDensity,
            rollupKey: areaKey || "",
            mobilityFlag,
            rollupCount,
            salonStrength,
          },
          signals,
        };
      }
    }

    // Ranked (stable tie-break)
    const ranked = [...outRows].sort((a, b) => {
      const d = (b.signals?.totalScore ?? 0) - (a.signals?.totalScore ?? 0);
      if (d !== 0) return d;
      return String(a.techId).localeCompare(String(b.techId));
    });

    // Write outputs
    const outDir = path.join(root, "tech", "signals");
    mkdirp(outDir);

    const outAbs = path.join(outDir, "tech_signals.json");
    const outRankedAbs = path.join(outDir, "tech_signals_ranked.json");
    const explainAbs = path.join(outDir, "tech_signals_explain.json");

    const signalsMeta = {
      formulaVersion,
      caps: {
        salonCount: salonCountCap,
        addressCount: addressCountCap,
        facilityDensity: facilityDensityCap,
        salonStrength: salonStrengthCap,
      },
      weights,
    };

    writeAtomicJson(outAbs, {
      ok: true,
      updatedAt,
      signalsMeta,
      rows: outRows,
    });

    writeAtomicJson(outRankedAbs, {
      ok: true,
      updatedAt,
      signalsMeta,
      rows: ranked,
    });

    if (writeExplain) {
      writeAtomicJson(explainAbs, explain);
    }

    // areas count (distinct in this run)
    const areas = areaCounts.size;

    return NextResponse.json({
      ok: true,
      rel: "data/co/dora/denver_metro/tech/signals/tech_signals_ranked.json",
      counts: { techs: outRows.length, areas },
      formulaVersion,
      updatedAt,
      fastMode,
      signalsMeta,
      explain: writeExplain ? "wrote tech_signals_explain.json" : "on-demand (no file explosion)",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
