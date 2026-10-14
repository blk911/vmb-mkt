import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { adminDb } from "@/lib/admin/firestoreAdmin";
import { loadSharedCatalog } from "@/lib/catalog/store";
import type { CatalogRecord } from "@/lib/catalog/types";
import { appendTargetActivity, normalizeTargetWorkflow } from "@/lib/ops/targetWorkflow";
import type { TargetActivity, TargetWorkflow } from "@/lib/ops/targetWorkflow";
import type { TargetItem, TargetList, TargetListIndex, TargetMembershipMode, TargetScope } from "./types";
import { validateDynamicFilters } from "./catalogMembership";

export const TARGET_LIST_COLLECTION = "shared_target_lists_v1";
export const TARGET_LIST_COVERAGE = {
  store: "firestore" as const,
  legacyFileLists: "not_imported_unverified" as const,
  message: "Shared lists are stored in Firestore. Legacy disk lists have not been imported; their coverage is unverified. Existing files are unchanged.",
};
const MAX_MEMBERS = 2500;
const MAX_DOCUMENT_BYTES = 700_000;

export class TargetListStoreError extends Error {
  constructor(public code: string, public status: number, message: string) {
    super(message);
    this.name = "TargetListStoreError";
  }
}

function invalid(message: string): never {
  throw new TargetListStoreError("invalid_list", 400, message);
}
function nonempty(value: unknown, field: string, max = 512) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) invalid(`Invalid ${field}.`);
  return value.trim();
}
function listId(value: unknown) {
  const id = nonempty(value, "list ID", 200);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) invalid("Invalid list ID.");
  return id;
}
function clean<T>(value: T): T {
  // Firestore rejects undefined nested fields. Normalize only JSON data, without a disk fallback.
  return JSON.parse(JSON.stringify(value)) as T;
}
function uniqueIds(values: unknown): string[] {
  if (!Array.isArray(values)) invalid("Catalog IDs must be an array.");
  const ids = Array.from(new Set(values.map((value) => nonempty(value, "catalog ID"))));
  if (ids.length > MAX_MEMBERS) invalid(`A fixed list supports at most ${MAX_MEMBERS} members.`);
  return ids;
}
function mode(value: unknown): TargetMembershipMode {
  if (value !== undefined && value !== "fixed" && value !== "dynamic") invalid("Invalid membership mode.");
  return value === "dynamic" ? "dynamic" : "fixed";
}
function query(value: TargetList["savedQuery"], membershipMode: TargetMembershipMode): TargetList["savedQuery"] {
  if (value !== undefined && (!value || typeof value !== "object" || Array.isArray(value))) invalid("Filters must be an object.");
  if (membershipMode === "dynamic") {
    try { return validateDynamicFilters(value || {}); }
    catch (error) { invalid(error instanceof Error ? error.message : "Invalid dynamic filters."); }
  }
  return value || {};
}
function note(value: unknown) {
  if (value !== undefined && (typeof value !== "string" || value.length > 20_000)) invalid("Notes must be text of at most 20,000 characters.");
  return typeof value === "string" ? value : "";
}

/** Only explicit canonical identities can be hydrated without a catalog lookup. */
export function catalogIdForItem(item: Pick<TargetItem, "kind" | "refId" | "catalogId">): string | undefined {
  if (item.catalogId) return item.catalogId;
  if (item.refId.startsWith("provider:") || item.refId.startsWith("business:")) return item.refId;
  return undefined;
}
function normalizeItem(item: Omit<TargetItem, "addedAt">, at: string): TargetItem {
  if (!item || (item.kind !== "tech" && item.kind !== "facility")) invalid("Invalid target kind.");
  const refId = nonempty(item.refId, "target reference");
  const catalogId = item.catalogId === undefined ? catalogIdForItem({ ...item, refId }) : nonempty(item.catalogId, "catalog ID");
  if (catalogId && !/^(provider|business):/.test(catalogId)) invalid("Fixed members must use stable catalog IDs.");
  return clean({
    kind: item.kind,
    refId,
    catalogId,
    referenceResolution: item.referenceResolution,
    label: typeof item.label === "string" ? item.label.slice(0, 1000) : refId,
    addressId: typeof item.addressId === "string" ? item.addressId.slice(0, 512) : undefined,
    city: typeof item.city === "string" ? item.city.slice(0, 200) : undefined,
    zip: typeof item.zip === "string" ? item.zip.slice(0, 30) : undefined,
    sizeBand: typeof item.sizeBand === "string" ? item.sizeBand.slice(0, 100) : undefined,
    tags: Array.isArray(item.tags) ? item.tags.filter((tag) => typeof tag === "string").slice(0, 30).map((tag) => tag.slice(0, 100)) : undefined,
    addedAt: at,
  });
}
function hydrate(id: string, data: unknown): TargetList {
  if (!data || typeof data !== "object") throw new TargetListStoreError("invalid_stored_list", 503, "The stored list could not be read.");
  const raw = data as TargetList;
  const items = (Array.isArray(raw.items) ? raw.items : []).map((item) => ({ ...item, catalogId: catalogIdForItem(item) }));
  return clean({
    ...raw,
    id,
    membershipMode: mode(raw.membershipMode),
    catalogIds: uniqueIds(raw.catalogIds ?? items.map((item) => item.catalogId).filter(Boolean)),
    items,
    workflow: normalizeTargetWorkflow(raw.workflow),
    activity: Array.isArray(raw.activity) ? raw.activity : [],
  });
}
function validateSize(list: TargetList) {
  if (list.catalogIds.length > MAX_MEMBERS || list.items.length > MAX_MEMBERS) invalid(`A fixed list supports at most ${MAX_MEMBERS} members.`);
  if (Buffer.byteLength(JSON.stringify(list), "utf8") > MAX_DOCUMENT_BYTES) invalid("This list is too large to save. Reduce its members or notes.");
}
function ensureFixed(list: TargetList) {
  if (list.membershipMode !== "fixed") throw new TargetListStoreError("dynamic_membership", 409, "Dynamic list membership is controlled by its saved filters. Create a fixed list to select individual records.");
}
function append(list: TargetList, type: string, detail: string) {
  list.activity = appendTargetActivity(list.activity, { at: list.updatedAt, type, detail });
}

export type CreateTargetListParams = {
  name: string;
  scope: TargetScope;
  membershipMode?: TargetMembershipMode;
  catalogIds?: string[];
  selectionSnapshots?: Array<Omit<TargetItem, "addedAt">>;
  savedQuery?: TargetList["savedQuery"];
  notes?: string;
  workflow?: Partial<TargetWorkflow>;
  actor?: string;
};
export type TargetListMetaPatch = {
  name?: string;
  savedQuery?: TargetList["savedQuery"];
  notes?: string;
  workflow?: Partial<TargetWorkflow>;
  activity?: TargetActivity[];
  activityEntry?: Omit<TargetActivity, "at">;
};

/** Injectable database factory permits hermetic transaction tests without production access. */
export function createTargetListStore(
  getDb: () => Firestore = adminDb,
  loadCatalog: () => Promise<{ rows: CatalogRecord[] }> = loadSharedCatalog,
) {
  async function withDb<T>(operation: (db: Firestore) => Promise<T>): Promise<T> {
    try {
      return await operation(getDb());
    } catch (error) {
      if (error instanceof TargetListStoreError) throw error;
      throw new TargetListStoreError("shared_list_store_unavailable", 503, "Shared list storage is unavailable. No local fallback was used; retry when Firestore is available.");
    }
  }
  async function readTargetList(id: string, options: { includeArchived?: boolean } = {}): Promise<TargetList | null> {
    const safeId = listId(id);
    return withDb(async (db) => {
      const snapshot = await db.collection(TARGET_LIST_COLLECTION).doc(safeId).get();
      if (!snapshot.exists) return null;
      const list = hydrate(safeId, snapshot.data());
      return list.archivedAt && !options.includeArchived ? null : list;
    });
  }
  async function listTargetLists(options: { includeArchived?: boolean } = {}): Promise<TargetListIndex> {
    return withDb(async (db) => {
      const snapshot = await db.collection(TARGET_LIST_COLLECTION).get();
      const lists = snapshot.docs.map((doc) => hydrate(doc.id, doc.data()))
        .filter((list) => options.includeArchived || !list.archivedAt)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return {
        ok: true,
        updatedAt: lists[0]?.updatedAt || new Date().toISOString(),
        coverage: TARGET_LIST_COVERAGE,
        lists: lists.map((list) => ({
          id: list.id, name: list.name, scope: list.scope, membershipMode: list.membershipMode,
          updatedAt: list.updatedAt, archivedAt: list.archivedAt,
          itemCount: list.membershipMode === "fixed" ? list.catalogIds.length + list.items.filter((item) => !item.catalogId).length : undefined,
        })),
      };
    });
  }
  async function mutate(id: string, change: (list: TargetList) => void, includeArchived = false): Promise<TargetList> {
    const safeId = listId(id);
    return withDb((db) => db.runTransaction(async (transaction) => {
      const ref = db.collection(TARGET_LIST_COLLECTION).doc(safeId);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new TargetListStoreError("not_found", 404, "Target list not found.");
      const list = hydrate(safeId, snapshot.data());
      if (list.archivedAt && !includeArchived) throw new TargetListStoreError("list_archived", 409, "This list is archived. Restore it before making changes.");
      list.updatedAt = new Date().toISOString();
      change(list);
      validateSize(list);
      const saved = clean(list);
      transaction.set(ref, saved);
      return saved;
    }));
  }
  async function createTargetList(params: CreateTargetListParams): Promise<TargetList> {
    const name = nonempty(params.name, "name", 200);
    if (params.scope !== "tech" && params.scope !== "facility") invalid("Invalid list scope.");
    const membershipMode = mode(params.membershipMode);
    const catalogIds = uniqueIds(params.catalogIds ?? []);
    if (catalogIds.some((id) => !/^(provider|business):/.test(id))) invalid("Fixed members must use stable catalog IDs.");
    if (membershipMode === "dynamic" && catalogIds.length) invalid("Dynamic lists use filters rather than fixed catalog IDs.");
    const selectionSnapshots = new Map((params.selectionSnapshots || []).map((item) => [item.catalogId, item]));
    const now = new Date().toISOString();
    const id = `tgt_${now.slice(0, 10).replace(/-/g, "")}_${randomUUID().replace(/-/g, "")}`;
    const list = clean<TargetList>({
      id, name, scope: params.scope, createdAt: now, updatedAt: now, membershipMode, catalogIds,
      savedQuery: query(params.savedQuery, membershipMode), notes: note(params.notes), workflow: normalizeTargetWorkflow(params.workflow),
      activity: [{ at: now, type: "created", detail: params.actor ? `Created by ${params.actor}.` : "Shared list created." }],
      items: catalogIds.map((catalogId) => normalizeItem({ ...selectionSnapshots.get(catalogId), kind: params.scope, refId: catalogId, catalogId, label: selectionSnapshots.get(catalogId)?.label || catalogId }, now)),
    });
    validateSize(list);
    return withDb((db) => db.runTransaction(async (transaction) => {
      const ref = db.collection(TARGET_LIST_COLLECTION).doc(id);
      const existing = await transaction.get(ref);
      if (existing.exists) throw new TargetListStoreError("list_exists", 409, "List ID already exists. Please retry.");
      transaction.create(ref, list);
      return list;
    }));
  }
  async function addItems(id: string, items: Array<Omit<TargetItem, "addedAt">>): Promise<TargetList> {
    if (!Array.isArray(items) || items.length > MAX_MEMBERS) invalid("Invalid target items.");
    const normalized = items.map((item) => normalizeItem(item, new Date().toISOString()));
    // Resolve legacy aliases only at this explicit save, then pin the canonical ID.
    // A later catalog change must never rebind a saved list's recipients.
    if (normalized.some((item) => item.kind === "tech" && !item.catalogId)) {
      let rows: CatalogRecord[];
      try { rows = (await loadCatalog()).rows; }
      catch { throw new TargetListStoreError("shared_catalog_unavailable", 503, "The shared catalog could not be loaded to resolve legacy references. No list changes were saved."); }
      for (const item of normalized) {
        if (item.kind !== "tech" || item.catalogId) continue;
        const matches = rows.filter((row) => row.legacyIds.includes(item.refId)
          || row.sourceRefs.some((ref) => ref.collection === "tech_index" && ref.id === item.refId));
        const candidates = [...new Set(matches.map((row) => row.id))];
        if (candidates.length === 1) item.catalogId = candidates[0];
        else item.referenceResolution = candidates.length > 1 ? "ambiguous" : "unresolved";
      }
    }
    return mutate(id, (list) => {
      ensureFixed(list);
      const keys = new Set(list.items.map((item) => item.catalogId || `${item.kind}:${item.refId}`));
      const legacyKeys = new Set(list.items.map((item) => `${item.kind}:${item.refId}`));
      const ids = new Set(list.catalogIds);
      let added = 0;
      for (const item of normalized) {
        const key = item.catalogId || `${item.kind}:${item.refId}`;
        if (keys.has(key) || legacyKeys.has(`${item.kind}:${item.refId}`)) continue;
        keys.add(key);
        legacyKeys.add(`${item.kind}:${item.refId}`);
        list.items.push(item);
        if (item.catalogId) ids.add(item.catalogId);
        added++;
      }
      list.catalogIds = [...ids];
      if (added) append(list, "targets_added", `Added ${added} target${added === 1 ? "" : "s"}.`);
    });
  }
  async function removeItems(id: string, refIds: string[]): Promise<TargetList> {
    const removals = new Set(uniqueIds(refIds));
    return mutate(id, (list) => {
      ensureFixed(list);
      const removedItems = list.items.filter((item) => removals.has(item.refId) || (item.catalogId && removals.has(item.catalogId)));
      const removedCatalogIds = new Set(removedItems.map((item) => item.catalogId).filter(Boolean));
      const countBefore = list.items.length;
      list.items = list.items.filter((item) => !removals.has(item.refId) && !(item.catalogId && removals.has(item.catalogId)));
      list.catalogIds = list.catalogIds.filter((catalogId) => !removals.has(catalogId) && !removedCatalogIds.has(catalogId));
      const removed = countBefore - list.items.length;
      if (removed) append(list, "targets_removed", `Removed ${removed} target${removed === 1 ? "" : "s"}.`);
    });
  }
  async function updateListMeta(id: string, patch: TargetListMetaPatch): Promise<TargetList> {
    return mutate(id, (list) => {
      if (patch.name !== undefined) list.name = nonempty(patch.name, "name", 200);
      if (patch.savedQuery !== undefined) list.savedQuery = query(patch.savedQuery, list.membershipMode);
      if (patch.notes !== undefined) list.notes = note(patch.notes);
      if (patch.workflow !== undefined) list.workflow = normalizeTargetWorkflow({ ...list.workflow, ...patch.workflow });
      // Compatibility for callers passing historical activity: merge rather than overwrite concurrent events.
      if (patch.activity !== undefined) {
        const events = [...patch.activity, ...(list.activity || [])];
        list.activity = [...new Map(events.map((event) => [JSON.stringify(event), event])).values()]
          .sort((a, b) => b.at.localeCompare(a.at)).slice(0, 25);
      }
      if (patch.activityEntry) append(list, patch.activityEntry.type, patch.activityEntry.detail);
    });
  }
  async function deleteTargetList(id: string, actor?: string): Promise<void> {
    await mutate(id, (list) => {
      if (list.archivedAt) return;
      list.archivedAt = list.updatedAt;
      if (actor) list.archivedBy = actor;
      append(list, "archived", actor ? `Archived by ${actor}. Membership is preserved.` : "List archived. Membership is preserved.");
    }, true);
  }
  async function restoreTargetList(id: string, actor?: string): Promise<TargetList> {
    return mutate(id, (list) => {
      delete list.archivedAt;
      delete list.archivedBy;
      append(list, "restored", actor ? `Restored by ${actor}.` : "List restored.");
    }, true);
  }
  return { listTargetLists, readTargetList, createTargetList, addItems, removeItems, updateListMeta, deleteTargetList, restoreTargetList };
}

const sharedStore = createTargetListStore();
export const { listTargetLists, readTargetList, createTargetList, addItems, removeItems, updateListMeta, deleteTargetList, restoreTargetList } = sharedStore;
