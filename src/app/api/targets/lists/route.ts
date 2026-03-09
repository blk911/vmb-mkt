import { NextResponse } from "next/server";
import {
  addItems,
  createTargetList,
  deleteTargetList,
  listTargetLists,
  readTargetList,
  removeItems,
  updateListMeta,
} from "@/app/admin/_lib/targets/store";
import { canAccessAdmin, getSessionUserFromCookieHeader } from "@/lib/auth/access";

type DashboardTargetList = {
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
  lists: DashboardTargetList[];
  updatedAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

function uniqStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function toDashboardList(list: Awaited<ReturnType<typeof readTargetList>>): DashboardTargetList | null {
  if (!list || list.scope !== "tech") return null;
  return {
    id: list.id,
    name: list.name,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    filters: list.savedQuery ?? {},
    techIds: uniqStrings(
      list.items
        .filter((item) => item.kind === "tech")
        .map((item) => item.refId)
    ),
    notes: list.notes ?? "",
  };
}

async function readDashboardStore(): Promise<Store> {
  const index = await listTargetLists();
  const techListIds = (index.lists || [])
    .filter((list) => list.scope === "tech")
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
    .map((list) => list.id);

  const lists = (
    await Promise.all(techListIds.map(async (listId) => toDashboardList(await readTargetList(listId))))
  ).filter(Boolean) as DashboardTargetList[];

  return {
    ok: true,
    kind: "targets_lists",
    version: "v1",
    lists,
    updatedAt: index.updatedAt || nowIso(),
  };
}

export async function GET() {
  const store = await readDashboardStore();
  return NextResponse.json(store, { status: 200 });
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

  const findList = async (id: string) => {
    const list = await readTargetList(id);
    if (!list || list.scope !== "tech") return null;
    return list;
  };

  if (!body || !(body as any).op) {
    return NextResponse.json({ ok: false, error: "missing_op" }, { status: 400 });
  }

  if (body.op === "delete") {
    const sessionUser = await getSessionUserFromCookieHeader(req.headers.get("cookie") || "");
    if (!canAccessAdmin(sessionUser)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
  }

  switch (body.op) {
    case "create": {
      const name = String(body.name || "").trim();
      if (!name) return NextResponse.json({ ok: false, error: "missing_name" }, { status: 400 });
      const list = await createTargetList({
        name,
        scope: "tech",
        savedQuery: body.filters ?? {},
        notes: body.notes ?? "",
      });
      return NextResponse.json({ ok: true, list: toDashboardList(list) }, { status: 200 });
    }

    case "rename": {
      const existing = await findList(body.id);
      if (!existing) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
      const list = await updateListMeta(body.id, {
        name: String(body.name || "").trim() || existing.name,
      });
      return NextResponse.json({ ok: true, list: toDashboardList(list) }, { status: 200 });
    }

    case "setNotes": {
      const existing = await findList(body.id);
      if (!existing) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
      const list = await updateListMeta(body.id, { notes: String(body.notes ?? "") });
      return NextResponse.json({ ok: true, list: toDashboardList(list) }, { status: 200 });
    }

    case "setFilters": {
      const existing = await findList(body.id);
      if (!existing) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
      const list = await updateListMeta(body.id, { savedQuery: body.filters ?? {} });
      return NextResponse.json({ ok: true, list: toDashboardList(list) }, { status: 200 });
    }

    case "addTech": {
      const existing = await findList(body.id);
      if (!existing) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
      const techId = String(body.techId || "").trim();
      if (!techId) return NextResponse.json({ ok: false, error: "missing_techId" }, { status: 400 });
      const list = await addItems(body.id, [{ kind: "tech", refId: techId, label: techId }]);
      return NextResponse.json({ ok: true, list: toDashboardList(list) }, { status: 200 });
    }

    case "removeTech": {
      const existing = await findList(body.id);
      if (!existing) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
      const techId = String(body.techId || "").trim();
      const list = await removeItems(body.id, [techId]);
      return NextResponse.json({ ok: true, list: toDashboardList(list) }, { status: 200 });
    }

    case "addMany": {
      const existing = await findList(body.id);
      if (!existing) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

      const ids = uniqStrings(Array.isArray(body.techIds) ? body.techIds : []);
      if (!ids.length) return NextResponse.json({ ok: false, error: "missing_techIds" }, { status: 400 });
      const list = await addItems(
        body.id,
        ids.map((id) => ({ kind: "tech" as const, refId: id, label: id }))
      );
      return NextResponse.json({ ok: true, list: toDashboardList(list), added: ids.length }, { status: 200 });
    }

    case "removeMany": {
      const existing = await findList(body.id);
      if (!existing) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

      const ids = uniqStrings(Array.isArray(body.techIds) ? body.techIds : []);
      if (!ids.length) return NextResponse.json({ ok: false, error: "missing_techIds" }, { status: 400 });
      const list = await removeItems(body.id, ids);
      return NextResponse.json({ ok: true, list: toDashboardList(list), removed: ids.length }, { status: 200 });
    }

    case "delete": {
      const existing = await findList(body.id);
      if (!existing) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
      await deleteTargetList(body.id);
      return NextResponse.json({ ok: true, deleted: body.id }, { status: 200 });
    }

    default:
      return NextResponse.json({ ok: false, error: "unknown_op" }, { status: 400 });
  }
}
