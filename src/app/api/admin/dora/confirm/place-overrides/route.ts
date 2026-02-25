import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

const OVR_REL = "data/co/dora/denver_metro/overrides/place_overrides.v1.json";

type OverrideRow = {
  addressKey: string;
  placeType?: "suite" | "salon" | "home" | "maildrop" | "unknown";
  placeName?: string | null;
  franchiseBrandId?: string | null;
  confidence?: number;
  notes?: string;
  mapsUrl?: string | null;
  website?: string | null;
  phone?: string | null;
  ig?: string | null;
};

function ensureDirForFile(relFile: string) {
  const abs = path.resolve(process.cwd(), relFile);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
}

function readOverrides(): { ok: true; updatedAt: string | null; rows: OverrideRow[] } {
  const abs = path.resolve(process.cwd(), OVR_REL);
  if (!fs.existsSync(abs)) {
    return { ok: true, updatedAt: null, rows: [] };
  }
  const j = JSON.parse(fs.readFileSync(abs, "utf8"));
  const rows = Array.isArray(j?.rows) ? j.rows : [];
  return { ok: true, updatedAt: j?.updatedAt ?? null, rows };
}

function writeOverrides(rows: OverrideRow[]) {
  ensureDirForFile(OVR_REL);
  const abs = path.resolve(process.cwd(), OVR_REL);
  const payload = { ok: true, updatedAt: new Date().toISOString(), rows };
  fs.writeFileSync(abs, JSON.stringify(payload, null, 2), "utf8");
}

function s(v: any) {
  return String(v ?? "").trim();
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapsUrlFromAddressKey(addressKey: string) {
  const q = addressKey.replace(/\s*\|\s*/g, " ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export async function GET() {
  return Response.json(readOverrides());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const addressKey = s(body?.addressKey);
  if (!addressKey) {
    return Response.json({ ok: false, error: "Missing addressKey" }, { status: 400 });
  }

  const placeType = s(body?.placeType) as OverrideRow["placeType"];
  const allowed = new Set(["suite", "salon", "home", "maildrop", "unknown"]);
  const safePlaceType = allowed.has(placeType ?? "") ? placeType : "unknown";

  const row: OverrideRow = {
    addressKey,
    placeType: safePlaceType,
    placeName: body?.placeName ?? null,
    franchiseBrandId: body?.franchiseBrandId ?? null,
    confidence: num(body?.confidence) ?? 0,
    notes: s(body?.notes ?? ""),
    mapsUrl: s(body?.mapsUrl) || mapsUrlFromAddressKey(addressKey),
    website: s(body?.website) || null,
    phone: s(body?.phone) || null,
    ig: s(body?.ig) || null,
  };

  const store = readOverrides();
  const rows = store.rows.slice();
  const i = rows.findIndex((r) => s(r.addressKey) === addressKey);

  if (i >= 0) rows[i] = { ...rows[i], ...row };
  else rows.push(row);

  // deterministic order: addressKey
  rows.sort((a, b) => s(a.addressKey).localeCompare(s(b.addressKey)));

  writeOverrides(rows);

  return Response.json({
    ok: true,
    saved: row,
    counts: { rows: rows.length },
    out: OVR_REL,
  });
}
