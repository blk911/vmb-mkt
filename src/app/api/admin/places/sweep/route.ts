import fs from "node:fs";
import { NextResponse } from "next/server";
import { sweepCandidatesAbs, sweepEffectiveAbs } from "../../../../admin/_lib/places/sweep/paths";
import { materializeAddressSweepEffective } from "../../../../admin/_lib/places/sweep/materializeEffective";

export async function GET() {
  const effAbs = sweepEffectiveAbs();
  if (fs.existsSync(effAbs)) {
    const doc = JSON.parse(fs.readFileSync(effAbs, "utf8"));
    return NextResponse.json(doc);
  }

  const candAbs = sweepCandidatesAbs();
  if (!fs.existsSync(candAbs)) {
    return NextResponse.json(
      { ok: false, error: "Missing address_sweep_candidates.v1.json. Run sweep first." },
      { status: 404 }
    );
  }

  try {
    const mat = materializeAddressSweepEffective();
    const doc = JSON.parse(fs.readFileSync(mat.outAbs, "utf8"));
    return NextResponse.json(doc);
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: String(e?.message || "failed_to_materialize"),
      },
      { status: 500 }
    );
  }
}
