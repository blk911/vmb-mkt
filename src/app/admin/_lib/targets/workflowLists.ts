import { listTargetLists, readTargetList } from "./store";
import type { TargetList } from "./types";
import { resolveTargetListMembership } from "./catalogMembership";
import { loadSharedCatalog } from "@/lib/catalog/store";

/** One current catalog snapshot for every workflow count and preview in this request. */
export async function loadTargetWorkflowLists() {
  const [index, catalog] = await Promise.all([listTargetLists(), loadSharedCatalog()]);
  const lists = (await Promise.all(index.lists.map((entry) => readTargetList(entry.id))))
    .filter((list): list is TargetList => !!list);
  return {
    coverage: index.coverage,
    catalogCoverage: catalog.coverage,
    generatedAt: catalog.generatedAt,
    lists: lists.map((list) => {
      const membership = resolveTargetListMembership(list, catalog.rows);
      return {
        id: list.id, name: list.name, updatedAt: list.updatedAt, scope: list.scope,
        membershipMode: list.membershipMode, techIds: membership.catalogIds, catalogIds: membership.catalogIds,
        resolvedTargetCount: membership.rows.length,
        unresolvedTargetCount: membership.missingIds.length + membership.unresolvedLegacyItems.length,
        workflow: list.workflow, activity: list.activity,
      };
    }),
  };
}
