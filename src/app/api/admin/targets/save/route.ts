import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

type TargetList = {
  id: string;
  name: string;
  createdAt: string;
  addressKeys: string[];
  meta?: Record<string, any>;
};

const OUT_REL = "data/co/dora/denver_metro/targets/targets.v1.json";

function ensureDirForFile(relFile: string) {
  const abs = path.resolve(process.cwd(), relFile);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
}

function readStore(): { ok: true; updatedAt: string; lists: TargetList[] } {
  const abs = path.resolve(process.cwd(), OUT_REL);
  if (!fs.existsSync(abs)) {
    return { ok: true, updatedAt: new Date().toISOString(), lists: [] };
  }
  const raw = fs.readFileSync(abs, "utf8");
  const j = JSON.parse(raw);
  const lists = Array.isArray(j?.lists) ? j.lists : [];
  return { ok: true, updatedAt: j?.updatedAt ?? new Date().toISOString(), lists };
}

function writeStore(lists: TargetList[]) {
  ensureDirForFile(OUT_REL);
  const abs = path.resolve(process.cwd(), OUT_REL);
  const payload = { ok: true, updatedAt: new Date().toISOString(), lists };
  fs.writeFileSync(abs, JSON.stringify(payload, null, 2), "utf8");
}

function uid() {
  // deterministic enough for local tool
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET() {
  const store = readStore();
  return Response.json(store);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const name = String(body?.name ?? "").trim();
  const addressKeysRaw = Array.isArray(body?.addressKeys) ? body.addressKeys : [];
  const addressKeys = Array.from(
    new Set(addressKeysRaw.map((x: any) => String(x ?? "").trim()).filter(Boolean))
  );

  if (!name) {
    return Response.json({ ok: false, error: "Missing name" }, { status: 400 });
  }
  if (!addressKeys.length) {
    return Response.json({ ok: false, error: "No addressKeys provided" }, { status: 400 });
  }

  const meta = typeof body?.meta === "object" && body?.meta ? body.meta : undefined;

  const store = readStore();
  const lists = store.lists;

  const item: TargetList = {
    id: uid(),
    name,
    createdAt: new Date().toISOString(),
    addressKeys,
    meta,
  };

  lists.unshift(item); // newest first
  writeStore(lists);

  return Response.json({
    ok: true,
    saved: item,
    counts: { lists: lists.length, addressKeys: addressKeys.length },
    out: OUT_REL,
  });
}
