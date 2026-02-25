import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { doraDenverDerivedAbs } from "@/backend/lib/paths/data-root";

function toRows(j: any): any[] {
  if (!j) return [];
  if (Array.isArray(j)) return j;
  if (Array.isArray(j.rows)) return j.rows;
  if (Array.isArray(j.data)) return j.data;
  return [];
}

function zip5(z?: string) {
  return String(z || "").replace(/[^0-9]/g, "").slice(0, 5);
}

function clampInt(v: any, def: number, min: number, max: number) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function normText(s: any) {
  return String(s || "").trim().toUpperCase();
}

export async function GET(req: Request, { params }: { params: Promise<{ cityKey: string }> | { cityKey: string } }) {
  const resolvedParams = await Promise.resolve(params);
  const cityKey = resolvedParams.cityKey || "";
  const decodedCityKey = decodeURIComponent(cityKey).trim();

  if (!decodedCityKey) {
    return NextResponse.json({ ok: false, error: "missing cityKey" }, { status: 400 });
  }

  try {
    // Parse query params
    const url = new URL(req.url);
    const q = normText(url.searchParams.get("q")); // street contains
    const zip = String(url.searchParams.get("zip") || "").replace(/[^0-9]/g, "").slice(0, 5);
    const candOnly = url.searchParams.get("cand") === "1";
    const minTech = clampInt(url.searchParams.get("minTech"), 0, 0, 999999);
    const sort = String(url.searchParams.get("sort") || "techDesc"); // techDesc, candDesc, zipAsc, streetAsc
    const page = clampInt(url.searchParams.get("page"), 1, 1, 999999);
    const pageSize = clampInt(url.searchParams.get("pageSize"), 200, 25, 500);

    // Force address source to derived truth (required - no fallback)
    const derivedDir = doraDenverDerivedAbs();
    const derivedAddressAbs = path.join(derivedDir, "address_truth_rollup.json");
    let addressJson: any;
    try {
      addressJson = JSON.parse(await fs.readFile(derivedAddressAbs, "utf8"));
    } catch (e: any) {
      return NextResponse.json(
        {
          ok: false,
          error: `Missing derived/address_truth_rollup.json. Run POST /api/admin/dora/truth/address-truth/rebuild first.`,
          hint: "The vmb_address_rollup.json fallback was removed because it contains city aggregates, not address-level data.",
        },
        { status: 500 }
      );
    }

    const addressRows = toRows(addressJson);

    // Normalize into API row format (address truth already has techCount and cand)
    const mapped = addressRows.map((a: any) => {
      const street1 = String(a.street1 || "").trim();
      const zip5v = zip5(a.zip5 || a.zip || a.zipCode);
      const regCount = Number(a.regCount || 0);
      const techCount = Number(a.techCount || 0);
      const cand = Number(a.cand || 0);

      let seg = "INDIE";
      if (regCount === 0 && techCount > 0) seg = "SOLO_AT_SOLO";
      if (regCount > 0 && techCount === 0) seg = "REG_ONLY";

      return {
        addressId: String(a.addressId || "").trim(),
        cityKey: String(a.cityKey || "").trim(),
        cityLabel: String(a.cityLabel || "").trim(),
        addressLabel: String(a.addressLabel || "").trim(),
        street1,
        city: String(a.city || "").trim(),
        state: String(a.state || "CO").trim(),
        zip5: zip5v,
        regCount,
        techCount,
        cand,
        seg,
      };
    });

    // Apply filters (cityKey first)
    let filtered = mapped.filter((r) => r.cityKey === decodedCityKey);

    // q: street contains
    if (q) filtered = filtered.filter((r) => r.street1.toUpperCase().includes(q));

    // zip exact
    if (zip) filtered = filtered.filter((r) => r.zip5 === zip);

    // cand only
    if (candOnly) filtered = filtered.filter((r) => r.cand > 0);

    // minTech
    if (minTech > 0) filtered = filtered.filter((r) => r.techCount >= minTech);

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sort) {
        case "candDesc":
          return b.cand - a.cand || b.techCount - a.techCount || a.street1.localeCompare(b.street1);
        case "zipAsc":
          return a.zip5.localeCompare(b.zip5) || b.techCount - a.techCount;
        case "streetAsc":
          return a.street1.localeCompare(b.street1) || b.techCount - a.techCount;
        case "techDesc":
        default:
          return b.techCount - a.techCount || b.cand - a.cand || a.street1.localeCompare(b.street1);
      }
    });

    // Paging
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const rows = filtered.slice(start, end);

    return NextResponse.json({
      ok: true,
      cityKey: decodedCityKey,
      page,
      pageSize,
      total,
      rows,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
