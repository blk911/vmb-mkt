import { NextResponse } from "next/server";
import { readSweepCandidates } from "../../../../../admin/_lib/places/sweep/paths";
import { upsertSweepAdjudicationMany } from "../../../../../admin/_lib/places/sweep/adjudications";
import { materializeAddressSweepEffective } from "../../../../../admin/_lib/places/sweep/materializeEffective";
import { createTargetList, addItems } from "@/app/admin/_lib/targets/store";

type BulkAction = "reject_out_of_scope" | "reject_maildrop" | "create_suite_center_target_list";

function safeStr(x: any) {
  return typeof x === "string" ? x : "";
}

function hasReason(row: any, reason: string) {
  const rs = Array.isArray(row?.reasons) ? row.reasons : [];
  return rs.includes(reason);
}

function parseCityZip(addressKey: string) {
  const parts = String(addressKey || "")
    .split("|")
    .map((s) => s.trim());
  return {
    city: parts.length >= 2 ? parts[1] : "",
    zip: parts.length >= 4 ? parts[3] : "",
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = safeStr(body?.action) as BulkAction;

  if (!action) {
    return NextResponse.json({ ok: false, error: "Missing action" }, { status: 400 });
  }

  const cand = await readSweepCandidates();
  const rows: any[] = Array.isArray(cand?.rows) ? cand.rows : [];
  if (!rows.length) {
    return NextResponse.json({ ok: false, error: "No sweep candidates to act on" }, { status: 400 });
  }

  if (action === "reject_out_of_scope") {
    const targets = rows.filter((r) => hasReason(r, "out_of_scope_state"));
    const items = targets.map((r) => ({
      addressKey: String(r?.addressKey || "").trim(),
      decision: "rejected" as const,
      reason: "out_of_scope_state",
      updatedAt: new Date().toISOString(),
    }));
    const changedCount = await upsertSweepAdjudicationMany(items);
    const effective = materializeAddressSweepEffective();
    return NextResponse.json({
      ok: true,
      action,
      changedCount,
      effective: { counts: effective.counts, updatedAt: effective.updatedAt },
    });
  }

  if (action === "reject_maildrop") {
    const targets = rows.filter((r) => r?.addressClass === "maildrop" || hasReason(r, "po_box_maildrop"));
    const items = targets.map((r) => ({
      addressKey: String(r?.addressKey || "").trim(),
      decision: "rejected" as const,
      reason: "maildrop",
      updatedAt: new Date().toISOString(),
    }));
    const changedCount = await upsertSweepAdjudicationMany(items);
    const effective = materializeAddressSweepEffective();
    return NextResponse.json({
      ok: true,
      action,
      changedCount,
      effective: { counts: effective.counts, updatedAt: effective.updatedAt },
    });
  }

  if (action === "create_suite_center_target_list") {
    const name = safeStr(body?.name) || `suite-centers-${new Date().toISOString().slice(0, 10)}`;
    const suite = rows.filter((r) => r?.addressClass === "suite_center");
    const inScope = suite.filter((r) => !hasReason(r, "out_of_scope_state"));
    const nonMail = inScope.filter((r) => r?.addressClass !== "maildrop" && !hasReason(r, "po_box_maildrop"));
    const addressKeys = nonMail
      .map((r) => String(r?.addressKey || "").trim())
      .filter(Boolean);

    const list = await createTargetList({
      name,
      scope: "facility",
    });

    const items = addressKeys.map((ak) => {
      const row = nonMail.find((x) => String(x?.addressKey || "").trim() === ak);
      const { city, zip } = parseCityZip(ak);
      const label = String(row?.topCandidate?.name || row?.effectiveTopCandidate?.name || ak);
      return {
        kind: "facility" as const,
        refId: ak,
        addressId: ak,
        label,
        city: city || undefined,
        zip: zip || undefined,
        tags: ["suite_center"],
      };
    });

    const updated = await addItems(list.id, items);
    const itemsAdded = updated?.items?.length ?? items.length;

    return NextResponse.json({
      ok: true,
      action,
      list: { id: list.id, name: list.name, scope: list.scope },
      itemsAdded,
      inputCounts: {
        suite_center: suite.length,
        in_scope: inScope.length,
        non_maildrop: nonMail.length,
      },
    });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
}
