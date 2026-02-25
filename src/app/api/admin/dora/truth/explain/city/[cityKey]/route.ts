import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { doraDenverDerivedAbs } from "@/backend/lib/paths/data-root";
import { ensureTruthRollups } from "@/backend/lib/dora/truth/ensureTruth";

export async function GET(_: Request, { params }: { params: { cityKey: string } }) {
  try {
    await ensureTruthRollups();
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
  try {
    const cityKey = decodeURIComponent(params.cityKey || "").trim();
    if (!cityKey) {
      return NextResponse.json({ ok: false, error: "missing cityKey" }, { status: 400 });
    }

    const derivedDir = doraDenverDerivedAbs();
    const address = JSON.parse(
      await fs.readFile(path.join(derivedDir, "address_truth_rollup.json"), "utf8")
    );
    const city = JSON.parse(await fs.readFile(path.join(derivedDir, "city_truth_rollup.json"), "utf8"));

    const cityRow = (city.rows || []).find((r: any) => r.cityKey === cityKey);
    if (!cityRow) {
      return NextResponse.json({ ok: false, error: "cityKey not found", cityKey }, { status: 404 });
    }

    const addrRows = (address.rows || []).filter((r: any) => r.cityKey === cityKey);

    // Top by techCount
    addrRows.sort((a: any, b: any) => b.techCount - a.techCount);

    const top = addrRows.slice(0, 50).map((r: any) => ({
      addressId: r.addressId,
      addressKey: r.addressKey,
      zip5: r.zip5,
      regCount: r.regCount,
      techCount: r.techCount,
      seg: r.seg,
      brandKey: r.brandKey,
      cand: r.cand,
      reasons: r.reasons,
    }));

    return NextResponse.json(
      {
        ok: true,
        city: cityRow,
        topAddresses: top,
        totals: {
          addresses: addrRows.length,
          regCount: addrRows.reduce((s: number, r: any) => s + (r.regCount || 0), 0),
          techCount: addrRows.reduce((s: number, r: any) => s + (r.techCount || 0), 0),
          candCount: addrRows.reduce((s: number, r: any) => s + (r.cand ? 1 : 0), 0),
        },
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "server error" },
      { status: 500 }
    );
  }
}
