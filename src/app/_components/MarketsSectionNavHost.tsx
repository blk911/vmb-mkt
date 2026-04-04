"use client";

import { usePathname } from "next/navigation";
import { canAccessMemberArea, type SessionUser } from "@/lib/auth/access";
import { isMarketsSectionPath } from "@/lib/admin/markets-section-nav";
import MarketsSectionSubnav from "@/components/admin/markets/MarketsSectionSubnav";

export default function MarketsSectionNavHost({ sessionUser }: { sessionUser: SessionUser }) {
  const pathname = usePathname() || "/";
  if (!sessionUser || !canAccessMemberArea(sessionUser)) return null;
  if (!isMarketsSectionPath(pathname)) return null;
  return <MarketsSectionSubnav sessionUser={sessionUser} />;
}
