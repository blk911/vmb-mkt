import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { dataRootAbs } from "../../../_lib/paths";
import { createTargetList, addItems } from "@/app/admin/_lib/targets/store";

function nowIso() {
  return new Date().toISOString();
}

function effectiveAbs() {
  return path.join(
    dataRootAbs(),
    "co",
    "dora",
    "denver_metro",
    "places",
    "derived",
    "places_matched_effective.v1.json"
  );
}

function cityFromAddressKey(addressKey: string) {
  const parts = String(addressKey || "")
    .split("|")
    .map((s) => s.trim());
  return parts.length >= 2 ? parts[1] : "";
}

function zipFromAddressKey(addressKey: string) {
  const parts = String(addressKey || "")
    .split("|")
    .map((s) => s.trim());
  return parts.length >= 4 ? parts[3] : "";
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = String(body?.name || "").trim() || `facility-targets-${nowIso().slice(0, 10)}`;
  const onlyBrand = body?.onlyBrand ? String(body.onlyBrand).trim() : "";

  if (!fs.existsSync(effectiveAbs())) {
    return NextResponse.json({ ok: false, error: "Missing places_matched_effective.v1.json" }, { status: 404 });
  }

  const eff: any = JSON.parse(fs.readFileSync(effectiveAbs(), "utf8"));
  const rows: any[] = Array.isArray(eff?.rows) ? eff.rows : [];

  const accepted = rows.filter((r) => (r?.adjudication?.decision ?? "unreviewed") === "accepted");
  const facilityRows = accepted
    .filter((r) => !!r?.facility?.facilityId && !!r?.facility?.addressKey)
    .filter((r) => (onlyBrand ? String(r?.facility?.brand || "") === onlyBrand : true));

  const items = facilityRows.map((r) => {
    const addressKey = String(r.facility.addressKey);
    const brand = String(r?.facility?.brand || "").trim();
    const category = String(r?.facility?.category || "").trim();
    const tags = [brand, category].filter(Boolean);

    return {
      kind: "facility" as const,
      refId: String(r.facility.facilityId),
      addressId: addressKey,
      label: String(r.facility.displayName || r.placeName || addressKey),
      city: cityFromAddressKey(addressKey) || undefined,
      zip: zipFromAddressKey(addressKey) || undefined,
      tags: tags.length ? tags : undefined,
    };
  });

  const list = await createTargetList({
    name,
    scope: "facility",
  });

  await addItems(list.id, items);

  return NextResponse.json({
    ok: true,
    created: { id: list.id, name: list.name, scope: "facility" },
    itemsAdded: items.length,
    updatedAt: nowIso(),
  });
}
