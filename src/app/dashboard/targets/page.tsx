import TargetsClient from "./TargetsClient";
import { redirectAdminWorkspaceAlias } from "../_lib/workspaceAlias";
import { catalogAliasDestination, type WorkspaceSearchParams } from "@/lib/admin/workspace-nav";

export const metadata = { title: "Prospects · Shared catalog" };

export default async function TargetsPage({ searchParams }: { searchParams?: Promise<WorkspaceSearchParams> }) {
  const params = await searchParams;
  await redirectAdminWorkspaceAlias(catalogAliasDestination(params), params);
  return <TargetsClient initialListId={typeof params?.listId === "string" ? params.listId : undefined} />;
}
