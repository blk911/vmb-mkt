import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUserFromCookies } from "@/lib/auth/access";
import { workspaceHref, type WorkspaceSearchParams } from "@/lib/admin/workspace-nav";

/** Keep the existing member routes available without widening Admin permissions. */
export async function redirectAdminWorkspaceAlias(destination: string, params?: WorkspaceSearchParams) {
  const sessionUser = await getSessionUserFromCookies(await cookies());
  if (sessionUser?.role === "admin") redirect(workspaceHref(destination, params));
}
