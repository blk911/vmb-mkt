import { NextResponse } from "next/server";
import fs from "fs";

const LISTS_PATH = "data/co/dora/denver_metro/targets/derived/targets_lists.v1.json";
const TECH_PATH = "data/co/dora/denver_metro/places/derived/tech_index.v4_facilities.v1.json";

function readJson(p: string) {
  const txt = fs.readFileSync(p, "utf8");
  return JSON.parse(txt);
}

function csvEscape(v: any) {
  const s = (v ?? "").toString();
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const listId = (url.searchParams.get("listId") || "").trim();
  const format = (url.searchParams.get("format") || "csv").trim().toLowerCase();

  if (!listId) {
    return NextResponse.json({ ok: false, error: "missing_listId" }, { status: 400 });
  }
  if (format !== "csv") {
    return NextResponse.json({ ok: false, error: "unsupported_format", format }, { status: 400 });
  }

  if (!fs.existsSync(LISTS_PATH)) {
    return NextResponse.json({ ok: false, error: "lists_store_missing", path: LISTS_PATH }, { status: 404 });
  }
  if (!fs.existsSync(TECH_PATH)) {
    return NextResponse.json({ ok: false, error: "tech_index_missing", path: TECH_PATH }, { status: 404 });
  }

  const store = readJson(LISTS_PATH);
  const list = (store?.lists || []).find((l: any) => l.id === listId);
  if (!list) {
    return NextResponse.json({ ok: false, error: "list_not_found", listId }, { status: 404 });
  }

  const techIndex = readJson(TECH_PATH);
  const tech = (techIndex?.tech || []) as any[];

  const byId = new Map<string, any>();
  for (const t of tech) byId.set(String(t.id), t);

  const rows = (list.techIds || [])
    .map((id: string) => byId.get(String(id)))
    .filter(Boolean);

  const header = [
    "listId",
    "listName",
    "techId",
    "displayName",
    "segment",
    "segmentConfidence",
    "doraLicenses",
    "addressKey",
    "city",
    "zip",
    "placeName",
    "placeScore",
    "types",
    "phone",
    "website",
  ];

  const lines: string[] = [];
  lines.push(header.join(","));

  for (const t of rows) {
    const place = t?.places?.best || {};
    const premise = t?.premise || {};
    const addr = t?.address || {};
    const types = (premise.types || place.types || []).map(String).join("|");

    const phone = (premise.phone || place.phone || "").toString().trim();
    const website = (premise.website || place.website || "").toString().trim();

    const line = [
      list.id,
      list.name,
      t.id,
      t.displayName || "",
      t.segment || "",
      (t.segmentConfidence ?? "").toString(),
      (t.techSignals?.doraLicenses ?? "").toString(),
      t.addressKey || "",
      addr.city || "",
      addr.zip || "",
      place.name || "",
      (place.score ?? "").toString(),
      types,
      phone,
      website,
    ].map(csvEscape);

    lines.push(line.join(","));
  }

  const csv = lines.join("\n");
  const safeName = (list.name || "targets").toString().replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
  const filename = `${safeName || "targets"}_${list.id}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
