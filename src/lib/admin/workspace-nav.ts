import { isMarketsSectionPath } from "./markets-section-nav";

export type WorkspaceSection = "prospects" | "lists" | "sources" | "tools";
export type WorkspaceSearchParams = Record<string, string | string[] | undefined>;

const sourcePaths = ["/admin/build", "/admin/source-intake", "/admin/sources", "/admin/sola-containers", "/admin/manual-ig-clusters", "/admin/operators/surface-recovery"];
const matches = (path: string, root: string) => path === root || path.startsWith(`${root}/`);

/** Markets and Live Units have their own workspace navigation. */
export function isAdminWorkspacePath(pathname: string): boolean {
  return matches(pathname, "/admin") && !isMarketsSectionPath(pathname) && !matches(pathname, "/admin/live-units") && pathname !== "/admin/login";
}

export function workspaceSection(pathname: string): WorkspaceSection {
  if (matches(pathname, "/admin/lists") || matches(pathname, "/dashboard/lists") || matches(pathname, "/dashboard/ops")) return "lists";
  if (sourcePaths.some((root) => matches(pathname, root))) return "sources";
  if (matches(pathname, "/admin/tools") || matches(pathname, "/admin/data") || matches(pathname, "/admin/activate")) return "tools";
  return "prospects";
}

/** Preserve repeated query values on legacy bookmarks and workflow return URLs. */
export function workspaceHref(pathname: string, params: WorkspaceSearchParams = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  }
  return query.size ? `${pathname}?${query}` : pathname;
}

export function catalogAliasDestination(params: WorkspaceSearchParams = {}): string {
  return typeof params.listId === "string" && params.listId ? "/admin/lists" : "/admin/prospects";
}
