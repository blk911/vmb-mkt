import { NextResponse } from "next/server";
import {
  addItems, createTargetList, deleteTargetList, listTargetLists, readTargetList, removeItems,
  restoreTargetList, TargetListStoreError, updateListMeta,
} from "@/app/admin/_lib/targets/store";
import type { TargetList, TargetMembershipMode, TargetScope } from "@/app/admin/_lib/targets/types";
import { resolveTargetListMembership, validateDynamicFilters } from "@/app/admin/_lib/targets/catalogMembership";
import { canAccessAdmin, canAccessMemberArea, getSessionUserFromCookieHeader } from "@/lib/auth/access";
import { normalizeTargetWorkflow, WORKFLOW_STAGES, WORKFLOW_DISPOSITIONS } from "@/lib/ops/targetWorkflow";
import type { TargetWorkflow } from "@/lib/ops/targetWorkflow";
import { loadSharedCatalog } from "@/lib/catalog/store";
import type { CatalogRecord } from "@/lib/catalog/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

function listJson(list: TargetList, rows: CatalogRecord[]) {
  const membership = resolveTargetListMembership(list, rows);
  const catalogIds = membership.catalogIds;
  return {
    id: list.id, name: list.name, scope: list.scope, createdAt: list.createdAt, updatedAt: list.updatedAt,
    membershipMode: list.membershipMode, catalogIds,
    filters: list.savedQuery || {},
    techIds: catalogIds,
    notes: list.notes || "", workflow: normalizeTargetWorkflow(list.workflow), activity: list.activity || [],
    archivedAt: list.archivedAt, archivedBy: list.archivedBy,
    unresolvedCatalogIds: membership.missingIds,
    unresolvedLegacyItems: membership.unresolvedLegacyItems,
    membershipResolved: true,
  };
}
function failure(error: unknown) {
  if (error instanceof TargetListStoreError) return json({ ok: false, error: error.code, message: error.message }, error.status);
  return json({ ok: false, error: "shared_catalog_unavailable", message: "The shared catalog is unavailable. No local data fallback was used." }, 503);
}
function text(value: unknown, field: string, max = 512) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new TargetListStoreError(`invalid_${field}`, 400, `Invalid ${field}.`);
  return value.trim();
}
function ids(value: unknown, field: string) {
  if (!Array.isArray(value) || value.length > 2500) throw new TargetListStoreError(`invalid_${field}`, 400, `Invalid ${field}.`);
  return [...new Set(value.map((entry) => text(entry, field)))];
}
function filters(value: unknown, membershipMode: TargetMembershipMode) {
  const supplied = value ?? {};
  if (!supplied || typeof supplied !== "object" || Array.isArray(supplied)) throw new TargetListStoreError("invalid_filters", 400, "Filters must be an object.");
  if (membershipMode === "dynamic") {
    try { return validateDynamicFilters(supplied); }
    catch (error) { throw new TargetListStoreError("invalid_filters", 400, error instanceof Error ? error.message : "Invalid filters."); }
  }
  return supplied as Record<string, unknown>;
}
function workflow(value: unknown): Partial<TargetWorkflow> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TargetListStoreError("invalid_workflow", 400, "Workflow must be an object.");
  const raw = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of ["owner", "stage", "disposition", "nextActionAt", "nextAction"] as const) {
    if (raw[key] !== undefined) {
      if (typeof raw[key] !== "string" || raw[key].length > 2000) throw new TargetListStoreError("invalid_workflow", 400, `Invalid workflow ${key}.`);
      result[key] = raw[key];
    }
  }
  if (raw.stage !== undefined && !(WORKFLOW_STAGES as readonly unknown[]).includes(raw.stage)) throw new TargetListStoreError("invalid_workflow", 400, "Invalid workflow stage.");
  if (raw.disposition !== undefined && !(WORKFLOW_DISPOSITIONS as readonly unknown[]).includes(raw.disposition)) throw new TargetListStoreError("invalid_workflow", 400, "Invalid workflow disposition.");
  if (raw.nextActionAt && !Number.isFinite(Date.parse(raw.nextActionAt as string))) throw new TargetListStoreError("invalid_workflow", 400, "Invalid next-action date.");
  if (raw.pinned !== undefined) {
    if (typeof raw.pinned !== "boolean") throw new TargetListStoreError("invalid_workflow", 400, "Invalid pinned value.");
    result.pinned = raw.pinned;
  }
  return result as Partial<TargetWorkflow>;
}

export async function GET(req: Request) {
  const user = await getSessionUserFromCookieHeader(req.headers.get("cookie") || "");
  if (!canAccessMemberArea(user)) return json({ ok: false, error: user ? "forbidden" : "unauthorized" }, user ? 403 : 401);
  const includeArchived = new URL(req.url).searchParams.get("includeArchived") === "true";
  if (includeArchived && !canAccessAdmin(user)) return json({ ok: false, error: "forbidden" }, 403);
  try {
    const index = await listTargetLists({ includeArchived });
    const lists = (await Promise.all(index.lists.map((entry) => readTargetList(entry.id, { includeArchived })))).filter((list): list is TargetList => !!list);
    const catalog = await loadSharedCatalog();
    return json({
      ok: true, kind: "targets_lists", version: "v1", lists: lists.map((list) => listJson(list, catalog.rows)),
      updatedAt: index.updatedAt, coverage: index.coverage, catalogCoverage: catalog.coverage,
    });
  } catch (error) { return failure(error); }
}

export async function POST(req: Request) {
  const user = await getSessionUserFromCookieHeader(req.headers.get("cookie") || "");
  if (!canAccessMemberArea(user)) return json({ ok: false, error: user ? "forbidden" : "unauthorized" }, user ? 403 : 401);
  const requestUrl = new URL(req.url);
  const host = req.headers.get("host") || requestUrl.host;
  let expectedOrigin = "";
  try { if (/^[a-z0-9.[\]:-]+$/i.test(host)) expectedOrigin = new URL(`${requestUrl.protocol}//${host}`).origin; } catch { /* Reject malformed Host. */ }
  if (!expectedOrigin || req.headers.get("origin") !== expectedOrigin) return json({ ok: false, error: "forbidden_origin" }, 403);
  if (req.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") return json({ ok: false, error: "json_required" }, 415);
  let raw: unknown;
  try {
    const reader = req.body?.getReader();
    if (!reader) return json({ ok: false, error: "invalid_json" }, 400);
    const parts: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > 750_000) { await reader.cancel(); return json({ ok: false, error: "request_too_large" }, 413); }
      parts.push(part.value);
    }
    raw = JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch { return json({ ok: false, error: "invalid_json" }, 400); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return json({ ok: false, error: "invalid_body" }, 400);
  const body = raw as Record<string, unknown>;
  const actor = user!.username;
  const op = body.op;
  if (typeof op !== "string") return json({ ok: false, error: "missing_op" }, 400);
  if (!["create", "rename", "setNotes", "setFilters", "setWorkflow", "addTech", "removeTech", "addMany", "removeMany", "delete", "archive", "restore"].includes(op)) return json({ ok: false, error: "unknown_op" }, 400);
  if (["delete", "archive", "restore"].includes(op) && !canAccessAdmin(user)) return json({ ok: false, error: "forbidden" }, 403);
  try {
    if (op === "create") {
      const membershipMode = body.membershipMode ?? "fixed";
      if (membershipMode !== "fixed" && membershipMode !== "dynamic") return json({ ok: false, error: "invalid_membershipMode" }, 400);
      const scope = body.scope ?? "tech";
      if (scope !== "tech" && scope !== "facility") return json({ ok: false, error: "invalid_scope" }, 400);
      const savedQuery = filters(body.filters, membershipMode);
      // Resolve before writing so a catalog failure cannot make a committed create look unsuccessful.
      const catalog = await loadSharedCatalog();
      const catalogIds = body.catalogIds === undefined ? [] : ids(body.catalogIds, "catalogIds");
      const byId = new Map(catalog.rows.map((row) => [row.id, row]));
      const list = await createTargetList({
        name: text(body.name, "name", 200), scope: scope as TargetScope, membershipMode,
        catalogIds,
        selectionSnapshots: catalogIds.map((id) => ({ kind: scope as TargetScope, refId: id, catalogId: id, label: byId.get(id)?.displayName || id, city: byId.get(id)?.city, zip: byId.get(id)?.postalCode })),
        savedQuery, notes: body.notes as string | undefined,
        workflow: body.workflow === undefined ? undefined : workflow(body.workflow), actor,
      });
      return json({ ok: true, list: listJson(list, catalog.rows) });
    }
    const id = text(body.id, "id", 200);
    const existing = await readTargetList(id, { includeArchived: op === "restore" || op === "archive" || op === "delete" });
    if (!existing) return json({ ok: false, error: "not_found" }, 404);
    if (op === "delete" || op === "archive") {
      await deleteTargetList(id, actor);
      return json({ ok: true, archived: id, deleted: id, recoverable: true });
    }
    const catalog = await loadSharedCatalog();
    let list: TargetList;
    let changes: { added?: number; removed?: number } = {};
    switch (op) {
      case "restore": list = await restoreTargetList(id, actor); break;
      case "rename":
        list = await updateListMeta(id, { name: text(body.name, "name", 200), activityEntry: { type: "renamed", detail: `Renamed by ${actor}.` } }); break;
      case "setNotes":
        if (typeof body.notes !== "string") return json({ ok: false, error: "invalid_notes" }, 400);
        list = await updateListMeta(id, { notes: body.notes as string, activityEntry: { type: "notes_updated", detail: `Notes updated by ${actor}.` } }); break;
      case "setFilters":
        if (body.filters === undefined) return json({ ok: false, error: "missing_filters" }, 400);
        list = await updateListMeta(id, { savedQuery: filters(body.filters, existing.membershipMode), activityEntry: { type: "filters_saved", detail: `Saved filters updated by ${actor}.` } }); break;
      case "setWorkflow":
        list = await updateListMeta(id, { workflow: workflow(body.workflow), activityEntry: { type: "workflow_updated", detail: `Workflow updated by ${actor}.` } }); break;
      case "addTech": case "addMany": {
        const explicit = body.catalogIds !== undefined || body.catalogId !== undefined;
        const additions = op === "addTech" ? [text(body.catalogId ?? body.techId, "targetId")] : ids(body.catalogIds ?? body.techIds, "targetIds");
        if (!additions.length) return json({ ok: false, error: "missing_targetIds" }, 400);
        list = await addItems(id, additions.map((refId) => { const row = explicit ? catalog.rows.find((row) => row.id === refId) : undefined; return { kind: existing.scope, refId, catalogId: explicit ? refId : undefined, label: row?.displayName || refId, city: row?.city, zip: row?.postalCode }; }));
        changes = { added: Math.max(0, list.items.length - existing.items.length) }; break;
      }
      case "removeTech": case "removeMany": {
        const removals = op === "removeTech" ? [text(body.catalogId ?? body.techId, "targetId")] : ids(body.catalogIds ?? body.techIds, "targetIds");
        if (!removals.length) return json({ ok: false, error: "missing_targetIds" }, 400);
        list = await removeItems(id, removals);
        changes = { removed: Math.max(0, existing.items.length - list.items.length) }; break;
      }
      default: return json({ ok: false, error: "unknown_op" }, 400);
    }
    return json({ ok: true, list: listJson(list, catalog.rows), ...changes });
  } catch (error) { return failure(error); }
}
