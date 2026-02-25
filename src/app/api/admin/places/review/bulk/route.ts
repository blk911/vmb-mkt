import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { dataRootAbs } from "../../../_lib/paths";
import { upsertAdjudication } from "../../../../../admin/_lib/places/adjudications";
import { materializePlacesMatchedEffective } from "../../../../../admin/_lib/places/materializeEffective";

type BulkAction = "accept_facility_exact" | "reject_dead";

function nowIso() {
  return new Date().toISOString();
}

function readJson(abs: string) {
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function placesMatchedFacilitiesAbs() {
  return path.join(
    dataRootAbs(),
    "co",
    "dora",
    "denver_metro",
    "places",
    "derived",
    "places_matched_facilities.v1.json"
  );
}

function receiptsDirAbs() {
  return path.join(dataRootAbs(), "co", "dora", "denver_metro", "places", "receipts");
}

function writeReceipt(payload: any) {
  fs.mkdirSync(receiptsDirAbs(), { recursive: true });
  const name = `adjudicate_bulk_${nowIso().replace(/[:.]/g, "-")}.json`;
  const abs = path.join(receiptsDirAbs(), name);
  fs.writeFileSync(abs, JSON.stringify(payload, null, 2), "utf8");
  return abs;
}

function isDeadRow(r: any) {
  const hasAnyPlaceField =
    !!String(r?.placeName || "").trim() ||
    !!String(r?.formattedAddress || "").trim() ||
    !!String(r?.googleUrl || "").trim() ||
    !!String(r?.website || "").trim() ||
    !!String(r?.phone || "").trim() ||
    (Array.isArray(r?.googleTypes) && r.googleTypes.length > 0);

  const score = Number(r?.matchScore ?? 0);
  const hasFacility = !!r?.facility;

  return !hasFacility && !hasAnyPlaceField && score === 0;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const action = String(body?.action || "").trim() as BulkAction;

  if (!["accept_facility_exact", "reject_dead"].includes(action)) {
    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  }

  const abs = placesMatchedFacilitiesAbs();
  if (!fs.existsSync(abs)) {
    return NextResponse.json({ ok: false, error: "Missing places_matched_facilities.v1.json" }, { status: 404 });
  }

  const doc = readJson(abs);
  const rows: any[] = Array.isArray(doc?.rows) ? doc.rows : [];

  const changed: Array<{ addressKey: string; decision: string }> = [];

  for (const r of rows) {
    const ak = String(r?.addressKey || "").trim();
    if (!ak) continue;

    if (action === "accept_facility_exact") {
      if (r?.facility?.matchMode === "exact") {
        upsertAdjudication({
          addressKey: ak,
          decision: "accepted",
          note: "bulk: facility exact",
          decidedAt: nowIso(),
        } as any);
        changed.push({ addressKey: ak, decision: "accepted" });
      }
    }

    if (action === "reject_dead") {
      if (isDeadRow(r)) {
        upsertAdjudication({
          addressKey: ak,
          decision: "rejected",
          note: "bulk: dead row",
          decidedAt: nowIso(),
        } as any);
        changed.push({ addressKey: ak, decision: "rejected" });
      }
    }
  }

  const eff = materializePlacesMatchedEffective();

  const receiptAbs = writeReceipt({
    ok: true,
    kind: "places_bulk_adjudication_receipt",
    action,
    changedCount: changed.length,
    changedSample: changed.slice(0, 50),
    effective: eff,
    updatedAt: nowIso(),
  });

  return NextResponse.json({
    ok: true,
    action,
    changedCount: changed.length,
    receiptAbs,
    effective: eff,
  });
}
