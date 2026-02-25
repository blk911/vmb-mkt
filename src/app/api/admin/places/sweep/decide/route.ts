import { NextResponse } from "next/server";
import type { SweepDecision } from "../../../../../admin/_lib/places/sweep/types";
import { upsertSweepAdjudication } from "../../../../../admin/_lib/places/sweep/adjudications";
import { materializeAddressSweepEffective } from "../../../../../admin/_lib/places/sweep/materializeEffective";

const ALLOWED: SweepDecision[] = [
  "confirm_candidate",
  "suite_center",
  "residential",
  "unknown",
  "no_storefront",
];

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const addressKey = String(body?.addressKey || "").trim();
  const decision = String(body?.decision || "").trim() as SweepDecision;
  const selectedCandidatePlaceId = String(body?.selectedCandidatePlaceId || "").trim();
  const selectedCandidateName = String(body?.selectedCandidateName || "").trim();
  const note = String(body?.note || "").slice(0, 500);

  if (!addressKey) {
    return NextResponse.json({ ok: false, error: "Missing addressKey" }, { status: 400 });
  }
  if (!ALLOWED.includes(decision)) {
    return NextResponse.json({ ok: false, error: "Invalid decision" }, { status: 400 });
  }
  if (decision === "confirm_candidate" && !selectedCandidatePlaceId && !selectedCandidateName) {
    return NextResponse.json(
      { ok: false, error: "confirm_candidate requires selected candidate info" },
      { status: 400 }
    );
  }

  const saved = upsertSweepAdjudication({
    addressKey,
    decision,
    selectedCandidatePlaceId: selectedCandidatePlaceId || undefined,
    selectedCandidateName: selectedCandidateName || undefined,
    note: note || undefined,
    decidedAt: new Date().toISOString(),
  });
  const effective = materializeAddressSweepEffective();

  return NextResponse.json({
    ok: true,
    adjudicationsUpdatedAt: saved.updatedAt,
    effective,
  });
}
