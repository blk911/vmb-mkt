import CatalogWorkspace from "@/components/catalog/CatalogWorkspace";
import type { WorkspaceSearchParams } from "@/lib/admin/workspace-nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prospects · Admin" };

export default async function ProspectsPage({ searchParams }: { searchParams?: Promise<WorkspaceSearchParams> }) {
  const params = await searchParams;
  return <CatalogWorkspace title="Prospects" initialListId={typeof params?.listId === "string" ? params.listId : undefined} admin />;
}
