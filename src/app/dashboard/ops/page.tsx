import ListWorkload from "@/components/catalog/ListWorkload";
import { redirectAdminWorkspaceAlias } from "../_lib/workspaceAlias";
import type { WorkspaceSearchParams } from "@/lib/admin/workspace-nav";

export const metadata = { title: "Work view · My lists" };

export default async function OpsPage({ searchParams }: { searchParams?: Promise<WorkspaceSearchParams> }) {
  await redirectAdminWorkspaceAlias("/admin/lists/work", await searchParams);
  return <ListWorkload listsHref="/dashboard/lists" />;
}
