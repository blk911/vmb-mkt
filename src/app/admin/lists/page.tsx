import CatalogWorkspace from "@/components/catalog/CatalogWorkspace";
import type { WorkspaceSearchParams } from "@/lib/admin/workspace-nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "My lists · Admin" };

export default async function ListsPage({ searchParams }: { searchParams?: Promise<WorkspaceSearchParams> }) {
  const params = await searchParams;
  return <CatalogWorkspace title="My lists" initialView="lists" initialListId={typeof params?.listId === "string" ? params.listId : undefined} admin />;
}
