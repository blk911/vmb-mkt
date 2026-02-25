import { NextResponse } from "next/server";
import { runAddressSweep } from "../../../../../admin/_lib/places/sweep/runSweep";
import { materializeAddressSweepEffective } from "../../../../../admin/_lib/places/sweep/materializeEffective";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const limitNum = Number(body?.limit);
  const limit = Number.isFinite(limitNum) && limitNum > 0 ? limitNum : undefined;
  const addressKeysRaw = Array.isArray(body?.addressKeys) ? body.addressKeys : null;
  const addressKeys = addressKeysRaw
    ? addressKeysRaw
        .map((s: any) => (typeof s === "string" ? s.trim() : ""))
        .filter(Boolean)
    : undefined;

  try {
    const out = await runAddressSweep({
      limit,
      addressKeys,
    });
    let effective: any = null;
    try {
      effective = materializeAddressSweepEffective();
    } catch (e: any) {
      effective = { error: String(e?.message || "materialize_failed") };
    }
    return NextResponse.json({
      ok: true,
      run: out,
      addressKeysProvided: addressKeys?.length ?? 0,
      effective,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: String(e?.message || "sweep_failed"),
      },
      { status: 500 }
    );
  }
}
