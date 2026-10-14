import CatalogWorkspace from "@/components/catalog/CatalogWorkspace";
import { redirectAdminWorkspaceAlias } from "../_lib/workspaceAlias";
import type { WorkspaceSearchParams } from "@/lib/admin/workspace-nav";

export const metadata = { title: "My lists · Shared catalog" };

export default async function ListsPage({ searchParams }: { searchParams?: Promise<WorkspaceSearchParams> }) {
  const params = await searchParams;
  await redirectAdminWorkspaceAlias("/admin/lists", params);
  return <CatalogWorkspace title="My lists" initialView="lists" initialListId={typeof params?.listId === "string" ? params.listId : undefined} />;
}
