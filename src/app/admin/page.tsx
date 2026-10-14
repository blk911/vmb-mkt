import { redirect } from "next/navigation";
import { catalogAliasDestination, workspaceHref, type WorkspaceSearchParams } from "@/lib/admin/workspace-nav";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams?: Promise<WorkspaceSearchParams> }) {
  const params = await searchParams;
  redirect(workspaceHref(catalogAliasDestination(params), params));
}
