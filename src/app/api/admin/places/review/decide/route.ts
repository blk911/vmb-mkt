import { NextResponse } from "next/server";
import { upsertAdjudication } from "../../../../../admin/_lib/places/adjudications";
import { materializePlacesMatchedEffective } from "../../../../../admin/_lib/places/materializeEffective";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const addressKey = String(body?.addressKey || "").trim();
  const decision = String(body?.decision || "").trim(); // accepted | rejected | defer
  const note = body?.note ? String(body.note).slice(0, 500) : "";

  if (!addressKey) {
    return NextResponse.json({ ok: false, error: "Missing addressKey" }, { status: 400 });
  }
  if (!["accepted", "rejected", "defer"].includes(decision)) {
    return NextResponse.json({ ok: false, error: "Invalid decision" }, { status: 400 });
  }

  const saved = upsertAdjudication({
    addressKey,
    decision: decision as any,
    note,
    decidedAt: new Date().toISOString(),
  });

  const eff = materializePlacesMatchedEffective();

  return NextResponse.json({ ok: true, adjudicationsUpdatedAt: saved.updatedAt, effective: eff });
}
