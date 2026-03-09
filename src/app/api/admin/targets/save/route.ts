import {
  addItems,
  createTargetList,
  listTargetLists,
  readTargetList,
} from "@/app/admin/_lib/targets/store";
import { canAccessAdmin, getSessionUserFromCookieHeader } from "@/lib/auth/access";

export const runtime = "nodejs";

type TargetList = {
  id: string;
  name: string;
  createdAt: string;
  addressKeys: string[];
  meta?: Record<string, any>;
};

function uniqStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function toLegacyList(list: Awaited<ReturnType<typeof readTargetList>>): TargetList | null {
  if (!list || list.scope !== "facility") return null;
  return {
    id: list.id,
    name: list.name,
    createdAt: list.createdAt,
    addressKeys: uniqStrings(
      list.items
        .filter((item) => item.kind === "facility")
        .map((item) => item.addressId || item.refId)
    ),
    meta: list.savedQuery,
  };
}

async function readLegacyStore() {
  const index = await listTargetLists();
  const facilityListIds = (index.lists || [])
    .filter((list) => list.scope === "facility")
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
    .map((list) => list.id);

  const lists = (
    await Promise.all(facilityListIds.map(async (listId) => toLegacyList(await readTargetList(listId))))
  ).filter(Boolean) as TargetList[];

  return {
    ok: true,
    updatedAt: index.updatedAt || new Date().toISOString(),
    lists,
  };
}

export async function GET() {
  const store = await readLegacyStore();
  return Response.json(store);
}

export async function POST(req: Request) {
  const sessionUser = await getSessionUserFromCookieHeader(req.headers.get("cookie") || "");
  if (!canAccessAdmin(sessionUser)) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

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
  const list = await createTargetList({
    name,
    scope: "facility",
    savedQuery: meta,
  });

  await addItems(
    list.id,
    addressKeys.map((addressKey) => ({
      kind: "facility" as const,
      refId: addressKey,
      addressId: addressKey,
      label: addressKey,
    }))
  );

  return Response.json({
    ok: true,
    saved: {
      id: list.id,
      name: list.name,
      createdAt: list.createdAt,
      addressKeys,
      meta,
    },
    counts: { addressKeys: addressKeys.length },
  });
}
