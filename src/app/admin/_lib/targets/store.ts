import fs from "node:fs";
import path from "node:path";
import { targetsDirAbs } from "../../../api/admin/_lib/paths";
import { writeJsonAtomic } from "../../../api/admin/_lib/atomic";
import type { TargetList, TargetListIndex } from "./types";
import { normalizeTargetWorkflow } from "@/lib/ops/targetWorkflow";

const INDEX_FILE = "targets_index.json";

function indexPathAbs() {
  return path.join(targetsDirAbs(), INDEX_FILE);
}

function listPathAbs(listId: string) {
  return path.join(targetsDirAbs(), `targets_${listId}.json`);
}

export async function listTargetLists(): Promise<TargetListIndex> {
  const indexPath = indexPathAbs();
  if (!fs.existsSync(indexPath)) {
    return { ok: true, updatedAt: new Date().toISOString(), lists: [] };
  }

  const txt = fs.readFileSync(indexPath, "utf8");
  const index = JSON.parse(txt) as TargetListIndex;
  return index;
}

export async function readTargetList(listId: string): Promise<TargetList | null> {
  const listPath = listPathAbs(listId);
  if (!fs.existsSync(listPath)) return null;

  const txt = fs.readFileSync(listPath, "utf8");
  return JSON.parse(txt) as TargetList;
}

export async function createTargetList(params: {
  name: string;
  scope: "facility" | "tech";
  savedQuery?: TargetList["savedQuery"];
  notes?: string;
}): Promise<TargetList> {
  const now = new Date().toISOString();
  const id = `tgt_${now.slice(0, 10).replace(/-/g, "")}_${Math.random().toString(36).slice(2, 8)}`;

  const list: TargetList = {
    id,
    name: params.name,
    scope: params.scope,
    createdAt: now,
    updatedAt: now,
    savedQuery: params.savedQuery,
    notes: params.notes,
    workflow: normalizeTargetWorkflow(),
    activity: [
      {
        at: now,
        type: "created",
        detail: "List created from saved filters.",
      },
    ],
    items: [],
  };

  await writeJsonAtomic(listPathAbs(id), list);

  // Update index
  const index = await listTargetLists();
  index.lists.push({
    id,
    name: params.name,
    scope: params.scope,
    updatedAt: now,
    itemCount: 0,
  });
  index.updatedAt = now;
  await writeJsonAtomic(indexPathAbs(), index);

  return list;
}

export async function addItems(
  listId: string,
  items: Array<{
    kind: "facility" | "tech";
    refId: string;
    addressId?: string;
    label: string;
    city?: string;
    zip?: string;
    sizeBand?: string;
    tags?: string[];
  }>
): Promise<TargetList> {
  const list = await readTargetList(listId);
  if (!list) throw new Error(`Target list ${listId} not found`);

  const existingKeys = new Set(list.items.map((i) => `${i.kind}:${i.refId}`));
  let addedCount = 0;

  for (const item of items) {
    const key = `${item.kind}:${item.refId}`;
    if (!existingKeys.has(key)) {
      list.items.push({
        ...item,
        addedAt: new Date().toISOString(),
      });
      existingKeys.add(key);
      addedCount += 1;
    }
  }

  list.updatedAt = new Date().toISOString();
  if (addedCount) {
    list.activity = [
      {
        at: list.updatedAt,
        type: "targets_added",
        detail: `Added ${addedCount} target${addedCount === 1 ? "" : "s"} to the list.`,
      },
      ...(list.activity || []),
    ].slice(0, 25);
  }
  await writeJsonAtomic(listPathAbs(listId), list);

  // Update index
  const index = await listTargetLists();
  const idxEntry = index.lists.find((l) => l.id === listId);
  if (idxEntry) {
    idxEntry.updatedAt = list.updatedAt;
    idxEntry.itemCount = list.items.length;
  }
  await writeJsonAtomic(indexPathAbs(), index);

  return list;
}

export async function removeItems(listId: string, refIds: string[]): Promise<TargetList> {
  const list = await readTargetList(listId);
  if (!list) throw new Error(`Target list ${listId} not found`);

  const removeSet = new Set(refIds);
  const beforeCount = list.items.length;
  list.items = list.items.filter((i) => !removeSet.has(i.refId));

  list.updatedAt = new Date().toISOString();
  const removedCount = beforeCount - list.items.length;
  if (removedCount > 0) {
    list.activity = [
      {
        at: list.updatedAt,
        type: "targets_removed",
        detail: `Removed ${removedCount} target${removedCount === 1 ? "" : "s"} from the list.`,
      },
      ...(list.activity || []),
    ].slice(0, 25);
  }
  await writeJsonAtomic(listPathAbs(listId), list);

  // Update index
  const index = await listTargetLists();
  const idxEntry = index.lists.find((l) => l.id === listId);
  if (idxEntry) {
    idxEntry.updatedAt = list.updatedAt;
    idxEntry.itemCount = list.items.length;
  }
  await writeJsonAtomic(indexPathAbs(), index);

  return list;
}

export async function updateListMeta(
  listId: string,
  patch: {
    name?: string;
    savedQuery?: TargetList["savedQuery"];
    notes?: string;
    workflow?: TargetList["workflow"];
    activity?: TargetList["activity"];
  }
): Promise<TargetList> {
  const list = await readTargetList(listId);
  if (!list) throw new Error(`Target list ${listId} not found`);

  if (patch.name !== undefined) list.name = patch.name;
  if (patch.savedQuery !== undefined) list.savedQuery = patch.savedQuery;
  if (patch.notes !== undefined) list.notes = patch.notes;
  if (patch.workflow !== undefined) list.workflow = normalizeTargetWorkflow(patch.workflow);
  if (patch.activity !== undefined) list.activity = patch.activity;

  list.updatedAt = new Date().toISOString();
  await writeJsonAtomic(listPathAbs(listId), list);

  // Update index
  const index = await listTargetLists();
  const idxEntry = index.lists.find((l) => l.id === listId);
  if (idxEntry) {
    idxEntry.updatedAt = list.updatedAt;
    if (patch.name !== undefined) idxEntry.name = patch.name;
  }
  await writeJsonAtomic(indexPathAbs(), index);

  return list;
}

export async function deleteTargetList(listId: string): Promise<void> {
  const listPath = listPathAbs(listId);
  if (fs.existsSync(listPath)) {
    fs.unlinkSync(listPath);
  }

  const index = await listTargetLists();
  index.lists = index.lists.filter((l) => l.id !== listId);
  index.updatedAt = new Date().toISOString();
  await writeJsonAtomic(indexPathAbs(), index);
}
