import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const STORE_PATH =
  "data/co/dora/denver_metro/targets/derived/targets_lists.v1.json";

type TargetList = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  filters?: any;
  techIds: string[];
  notes?: string;
};

type Store = {
  ok: true;
  kind: "targets_lists";
  version: "v1";
  lists: TargetList[];
  updatedAt: string;
};

function ensureDirForFile(p: string) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function stableId(prefix = "list") {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function readStore(): Store {
  if (!fs.existsSync(STORE_PATH)) {
    return { ok: true, kind: "targets_lists", version: "v1", lists: [], updatedAt: nowIso() };
  }
  const text = fs.readFileSync(STORE_PATH, "utf8");
  const j = JSON.parse(text);
  if (!j?.lists || !Array.isArray(j.lists)) {
    return { ok: true, kind: "targets_lists", version: "v1", lists: [], updatedAt: nowIso() };
  }
  return j as Store;
}

function writeStore(store: Store) {
  ensureDirForFile(STORE_PATH);
  store.updatedAt = nowIso();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function GET() {
  const store = readStore();
  // newest first
  const lists = (store.lists || []).slice().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return NextResponse.json({ ok: true, ...store, lists }, { status: 200 });
}

type PostBody =
  | {
      op: "create";
      name: string;
      filters?: any;
      notes?: string;
    }
  | {
      op: "rename";
      id: string;
      name: string;
    }
  | {
      op: "setNotes";
      id: string;
      notes: string;
    }
  | {
      op: "setFilters";
      id: string;
      filters: any;
    }
  | {
      op: "addTech";
      id: string;
      techId: string;
    }
  | {
      op: "removeTech";
      id: string;
      techId: string;
    }
  | {
      op: "addMany";
      id: string;
      techIds: string[];
    }
  | {
      op: "removeMany";
      id: string;
      techIds: string[];
    }
  | {
      op: "delete";
      id: string;
    };

export async function POST(req: Request) {
  let body: PostBody | null = null;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const store = readStore();
  const lists = store.lists || [];

  const findIdx = (id: string) => lists.findIndex((x) => x.id === id);

  if (!body || !(body as any).op) {
    return NextResponse.json({ ok: false, error: "missing_op" }, { status: 400 });
  }

  switch (body.op) {
    case "create": {
      const name = String(body.name || "").trim();
      if (!name) return NextResponse.json({ ok: false, error: "missing_name" }, { status: 400 });

      const id = stableId("tl");
      const t: TargetList = {
        id,
        name,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        filters: body.filters ?? {},
        notes: body.notes ?? "",
        techIds: [],
      };
      lists.push(t);
      store.lists = lists;
      writeStore(store);
      return NextResponse.json({ ok: true, list: t }, { status: 200 });
    }

    case "rename": {
      const idx = findIdx(body.id);
      if (idx < 0) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
      lists[idx].name = String(body.name || "").trim() || lists[idx].name;
      lists[idx].updatedAt = nowIso();
      writeStore(store);
      return NextResponse.json({ ok: true, list: lists[idx] }, { status: 200 });
    }

    case "setNotes": {
      const idx = findIdx(body.id);
      if (idx < 0) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
      lists[idx].notes = String(body.notes ?? "");
      lists[idx].updatedAt = nowIso();
      writeStore(store);
      return NextResponse.json({ ok: true, list: lists[idx] }, { status: 200 });
    }

    case "setFilters": {
      const idx = findIdx(body.id);
      if (idx < 0) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
      lists[idx].filters = body.filters ?? {};
      lists[idx].updatedAt = nowIso();
      writeStore(store);
      return NextResponse.json({ ok: true, list: lists[idx] }, { status: 200 });
    }

    case "addTech": {
      const idx = findIdx(body.id);
      if (idx < 0) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
      const techId = String(body.techId || "").trim();
      if (!techId) return NextResponse.json({ ok: false, error: "missing_techId" }, { status: 400 });
      const set = new Set(lists[idx].techIds || []);
      set.add(techId);
      lists[idx].techIds = Array.from(set);
      lists[idx].updatedAt = nowIso();
      writeStore(store);
      return NextResponse.json({ ok: true, list: lists[idx] }, { status: 200 });
    }

    case "removeTech": {
      const idx = findIdx(body.id);
      if (idx < 0) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
      const techId = String(body.techId || "").trim();
      const set = new Set(lists[idx].techIds || []);
      set.delete(techId);
      lists[idx].techIds = Array.from(set);
      lists[idx].updatedAt = nowIso();
      writeStore(store);
      return NextResponse.json({ ok: true, list: lists[idx] }, { status: 200 });
    }

    case "addMany": {
      const idx = findIdx(body.id);
      if (idx < 0) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

      const ids = Array.isArray(body.techIds) ? body.techIds.map(String).map((s) => s.trim()).filter(Boolean) : [];
      if (!ids.length) return NextResponse.json({ ok: false, error: "missing_techIds" }, { status: 400 });

      const set = new Set(lists[idx].techIds || []);
      for (const id of ids) set.add(id);
      lists[idx].techIds = Array.from(set);
      lists[idx].updatedAt = nowIso();
      writeStore(store);
      return NextResponse.json({ ok: true, list: lists[idx], added: ids.length }, { status: 200 });
    }

    case "removeMany": {
      const idx = findIdx(body.id);
      if (idx < 0) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

      const ids = Array.isArray(body.techIds) ? body.techIds.map(String).map((s) => s.trim()).filter(Boolean) : [];
      if (!ids.length) return NextResponse.json({ ok: false, error: "missing_techIds" }, { status: 400 });

      const set = new Set(lists[idx].techIds || []);
      for (const id of ids) set.delete(id);
      lists[idx].techIds = Array.from(set);
      lists[idx].updatedAt = nowIso();
      writeStore(store);
      return NextResponse.json({ ok: true, list: lists[idx], removed: ids.length }, { status: 200 });
    }

    case "delete": {
      const idx = findIdx(body.id);
      if (idx < 0) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
      const [removed] = lists.splice(idx, 1);
      store.lists = lists;
      writeStore(store);
      return NextResponse.json({ ok: true, deleted: removed.id }, { status: 200 });
    }

    default:
      return NextResponse.json({ ok: false, error: "unknown_op" }, { status: 400 });
  }
}
