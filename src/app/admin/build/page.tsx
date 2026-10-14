import { redirect } from "next/navigation";
import { workspaceHref, type WorkspaceSearchParams } from "@/lib/admin/workspace-nav";

export default async function BuildPage({ searchParams }: { searchParams?: Promise<WorkspaceSearchParams> }) {
  redirect(workspaceHref("/admin/sources/import", await searchParams));
}
