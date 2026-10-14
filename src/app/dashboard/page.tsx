import { redirect } from "next/navigation";
import { workspaceHref, type WorkspaceSearchParams } from "@/lib/admin/workspace-nav";

export default async function DashboardIndex({ searchParams }: { searchParams?: Promise<WorkspaceSearchParams> }) {
  redirect(workspaceHref("/dashboard/targets", await searchParams));
}
