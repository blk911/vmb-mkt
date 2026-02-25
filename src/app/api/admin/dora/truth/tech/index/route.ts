import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { doraDenverTechIndexAbs } from "@/backend/lib/paths/data-root";

function clampInt(v: any, def: number, min: number, max: number) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function s(v: any) {
  if (v == null) return "";
  return String(v).trim();
}

function normText(v: any) {
  return s(v).toUpperCase();
}

function boolParam(url: URL, key: string) {
  return url.searchParams.get(key) === "1";
}

export async function GET(req: Request) {
  try {
    const techDir = doraDenverTechIndexAbs(); // should point to .../data/co/dora/denver_metro/tech
    const indexAbs = path.join(techDir, "index.json");
    const signalsRankedAbs = path.join(techDir, "signals", "tech_signals_ranked.json");

    const url = new URL(req.url);

    // Query params
    const q = s(url.searchParams.get("q"));
    const service = normText(url.searchParams.get("service")); // reserved (no-op until we have service tags)
    const area = s(url.searchParams.get("area"));

    const hasSalon = boolParam(url, "hasSalon");
    const mobility = boolParam(url, "mobility");
    const multiSalon = boolParam(url, "multiSalon");
    const independent = boolParam(url, "independent"); // interpreted as "no salon attached"
    const highDensity = boolParam(url, "highDensity"); // uses density>=75 by default

    const sort = s(url.searchParams.get("sort")) || "totalDesc";

    // Support both pageSize and limit (limit overrides)
    const limit = url.searchParams.get("limit");
    const page = clampInt(url.searchParams.get("page"), 1, 1, 999999);

    const pageSize =
      limit != null && s(limit) !== ""
        ? clampInt(limit, 100, 1, 5000)
        : clampInt(url.searchParams.get("pageSize"), 100, 1, 5000);

    // Load tech index
    const indexJson = JSON.parse(await fs.readFile(indexAbs, "utf8"));
    const techRows: any[] = indexJson.rows || [];
    const techsMap = new Map(techRows.map((t: any) => [t.techId, t]));

    // Load signals (ranked) or fallback
    let signalsRows: any[] = [];
    try {
      const signalsJson = JSON.parse(await fs.readFile(signalsRankedAbs, "utf8"));
      signalsRows = signalsJson.rows || [];
    } catch {
      signalsRows = techRows.map((t: any) => ({
        techId: t.techId,
        signals: t.signals || null,
      }));
    }

    // De-dupe signals: keep best row per techId (highest totalScore, stable tie-break)
    const bestSignalsByTechId = new Map<string, any>();

    for (const sr of signalsRows) {
      const techId = String(sr.techId || "");
      if (!techId) continue;

      const signals = sr.signals || {
        totalScore: sr.totalScore,
        demand: sr.demand,
        density: sr.density,
        network: sr.network,
        mobility: sr.mobility,
        stability: sr.stability,
      };

      const cand = { ...sr, techId, signals };

      const prev = bestSignalsByTechId.get(techId);
      if (!prev) {
        bestSignalsByTechId.set(techId, cand);
        continue;
      }

      const prevScore = Number(prev?.signals?.totalScore ?? prev?.totalScore ?? 0);
      const candScore = Number(cand?.signals?.totalScore ?? cand?.totalScore ?? 0);

      if (candScore > prevScore) {
        bestSignalsByTechId.set(techId, cand);
      } else if (candScore === prevScore) {
        // stable: keep lexicographically smallest techId (should be same), else keep existing
        // no-op
      }
    }

    const merged = Array.from(bestSignalsByTechId.values()).map((sr: any) => {
      const tech = techsMap.get(sr.techId) || {};
      const signals = sr.signals;

      return {
        ...tech,
        techId: sr.techId || tech.techId,
        signals: signals || null,

        totalScore: signals?.totalScore ?? null,
        demand: signals?.demand ?? null,
        density: signals?.density ?? null,
        network: signals?.network ?? null,
        mobility: signals?.mobility ?? null,
        stability: signals?.stability ?? null,
      };
    });

    // Filters (apply BEFORE pagination)
    const qNorm = normText(q);
    let filtered = merged.filter((r) => {
      // q filter
      if (qNorm) {
        const name = normText(r.name);
        const lic = normText(r.licenseNumber);
        if (!name.includes(qNorm) && !lic.includes(qNorm)) return false;
      }

      // service filter (no-op until we have service tags)
      if (service) {
        // if you later add r.services: string[]
        const services = Array.isArray(r.services) ? r.services.map(normText) : [];
        if (!services.includes(service)) return false;
      }

      // hasSalon
      const salonCount = Number(r.salonCount ?? 0);
      if (hasSalon && salonCount <= 0) return false;

      // independent = no salon attached
      if (independent && salonCount > 0) return false;

      // multiSalon
      if (multiSalon && salonCount <= 1) return false;

      // mobility = mobilityFlag true
      if (mobility && !r.mobilityFlag) return false;

      // area filter hits primary/home/areaKey
      if (area) {
        const a = normText(area);
        const primary = normText(r.primaryRollupKey);
        const home = normText(r.homeRollupKey);
        const areaKey = normText(r.areaKey);
        if (primary !== a && home !== a && areaKey !== a) return false;
      }

      // highDensity (default threshold 75)
      if (highDensity) {
        const d = Number(r.signals?.density ?? r.density ?? 0);
        if (d < 75) return false;
      }

      return true;
    });

    // Sorting
    const getNum = (r: any, k: string) => Number(r?.signals?.[k] ?? r?.[k] ?? 0);

    filtered.sort((a, b) => {
      switch (sort) {
        case "densityDesc":
          return getNum(b, "density") - getNum(a, "density") || String(a.techId).localeCompare(String(b.techId));
        case "demandDesc":
          return getNum(b, "demand") - getNum(a, "demand") || String(a.techId).localeCompare(String(b.techId));
        case "networkDesc":
          return getNum(b, "network") - getNum(a, "network") || String(a.techId).localeCompare(String(b.techId));
        case "mobilityDesc":
          return getNum(b, "mobility") - getNum(a, "mobility") || String(a.techId).localeCompare(String(b.techId));
        case "stabilityDesc":
          return getNum(b, "stability") - getNum(a, "stability") || String(a.techId).localeCompare(String(b.techId));
        case "salonCountDesc":
          return Number(b.salonCount ?? 0) - Number(a.salonCount ?? 0) || String(a.techId).localeCompare(String(b.techId));
        case "nameAsc":
          return normText(a.name).localeCompare(normText(b.name)) || String(a.techId).localeCompare(String(b.techId));
        case "totalDesc":
        default:
          return getNum(b, "totalScore") - getNum(a, "totalScore") || String(a.techId).localeCompare(String(b.techId));
      }
    });

    // Pagination
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pageRows = filtered.slice(start, end);

    return NextResponse.json({
      ok: true,
      page,
      pageSize,
      total,
      rows: pageRows,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
