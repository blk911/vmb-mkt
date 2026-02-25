import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { doraDenverTechIndexAbs } from "@/backend/lib/paths/data-root";

export async function GET(_: Request, { params }: { params: Promise<{ techId: string }> | { techId: string } }) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const techId = String(resolvedParams.techId || "").trim();

    if (!techId) {
      return NextResponse.json({ ok: false, error: "missing techId" }, { status: 400 });
    }

    // Load signals data (compute explain on-demand)
    const techDir = doraDenverTechIndexAbs();
    const signalsAbs = path.join(techDir, "signals", "tech_signals.json");

    let signalsJson: any;
    try {
      signalsJson = JSON.parse(await fs.readFile(signalsAbs, "utf8"));
    } catch {
      return NextResponse.json({ ok: false, error: "Signals not found. Run materialization first." }, { status: 404 });
    }

    const signalsRows = signalsJson.rows || [];
    const row = signalsRows.find((r: any) => r.techId === techId);

    if (!row) {
      return NextResponse.json({ ok: false, error: "Tech not found" }, { status: 404 });
    }

    // Compute explain from row data
    const inputs = row._inputs || {};
    const signals = row.signals || {
      demand: row.demand,
      density: row.density,
      network: row.network,
      mobility: row.mobility,
      stability: row.stability,
      totalScore: row.totalScore,
    };

    // Build notes
    const notes: string[] = [];
    if (inputs.salonCount > 1) notes.push("multi-salon tech boosted mobility");
    if (inputs.facilityDensity > 0) {
      // We'd need maxFacilityDensity to compute threshold, but for now just note if density exists
      notes.push("facility density in area");
    }
    if (inputs.addressCount > 1) notes.push("multiple addresses indicate mobility");
    if (inputs.salonCount === 1 && inputs.addressCount === 1) notes.push("single salon + single address indicates stability");

    const explain = {
      techId,
      computedAt: signalsJson.updatedAt || new Date().toISOString(),
      inputs,
      signals,
      formulaVersion: signalsJson.formulaVersion || "tech-signals.v1",
      notes,
    };

    return NextResponse.json({ ok: true, explain });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
