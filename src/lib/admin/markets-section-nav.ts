/** Markets list with Nail category preset (no dedicated /admin/markets/nails route). */
export const MARKETS_NAILS_LIST_HREF = "/admin/markets?category=Nail";

export function isMarketsSectionPath(pathname: string): boolean {
  return (
    pathname === "/admin/markets" ||
    pathname.startsWith("/admin/markets/") ||
    pathname === "/admin/social-targets" ||
    pathname.startsWith("/admin/social-targets/")
  );
}

/** Global MARKETS top pill stays active for the whole Markets + Social Targets section. */
export function isMarketsGlobalNavActive(pathname: string): boolean {
  return isMarketsSectionPath(pathname);
}
