"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { MARKETS_NAILS_LIST_HREF } from "@/lib/admin/markets-section-nav";
import { canAccessAdmin, type SessionUser } from "@/lib/auth/access";

function MarketsSectionSubnavInner({ sessionUser }: { sessionUser: SessionUser }) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const category = searchParams.get("category") || "All";
  const showSocial = canAccessAdmin(sessionUser);

  const isNails = pathname === "/admin/markets" && category === "Nail";
  const isMarkets =
    (pathname === "/admin/markets" && !isNails) ||
    pathname.startsWith("/admin/markets/member/") ||
    pathname.startsWith("/admin/markets/target/");
  const isUnknown = pathname.startsWith("/admin/markets/unknown-resolver");
  const isOutreach = pathname.startsWith("/admin/markets/outreach-queue");
  const isSocial = pathname === "/admin/social-targets" || pathname.startsWith("/admin/social-targets/");

  const items: { href: string; label: string; active: boolean }[] = [
    { href: "/admin/markets", label: "Markets", active: isMarkets },
    { href: MARKETS_NAILS_LIST_HREF, label: "Nails", active: isNails },
    { href: "/admin/markets/unknown-resolver", label: "Unknown Resolver", active: isUnknown },
    { href: "/admin/markets/outreach-queue", label: "Outreach Queue", active: isOutreach },
  ];
  if (showSocial) {
    items.push({ href: "/admin/social-targets", label: "Social Targets", active: isSocial });
  }

  return (
    <nav
      className="border-b border-neutral-200 bg-neutral-50/95 px-4 py-2"
      aria-label="Markets section navigation"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition ${
              item.active
                ? "border-blue-300 bg-blue-100 text-blue-950"
                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export default function MarketsSectionSubnav({ sessionUser }: { sessionUser: SessionUser }) {
  return (
    <Suspense fallback={<div className="h-10 border-b border-neutral-200 bg-neutral-50/95" aria-hidden />}>
      <MarketsSectionSubnavInner sessionUser={sessionUser} />
    </Suspense>
  );
}
