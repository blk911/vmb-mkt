"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback } from "react";
import { isMarketsSectionPath } from "@/lib/admin/markets-section-nav";
import { isAdminWorkspacePath, isLegacyMarketToolsPath } from "@/lib/admin/workspace-nav";
import MarketsSectionSubnav from "@/components/admin/markets/MarketsSectionSubnav";
import { canAccessMemberArea, canShowNavItem, type SessionUser } from "@/lib/auth/access";

type AppLink = {
  id: string;
  label: string;
  href: string;
  external?: boolean;
  /** Override default pathname-prefix active check */
  isActive?: (pathname: string) => boolean;
};

const MARKETING_LINK: AppLink = {
  id: "marketing",
  label: "VMB SALONS",
  href: "/marketing-decks",
};
const REQUEST_ACCESS_LINK: AppLink = { id: "request_access", label: "REQUEST ACCESS", href: "/access/request" };
const LOGIN_LINK: AppLink = { id: "login", label: "LOGIN", href: "/auth/login" };
const PROSPECTS_LINK: AppLink = { id: "datastore", label: "PROSPECTS", href: "/dashboard/targets", isActive: (pathname) => pathname === "/dashboard" || pathname.startsWith("/dashboard/") };
const TEAM_LINK: AppLink = { id: "team", label: "TEAM", href: "/team" };
const ADMIN_LINK: AppLink = { id: "admin", label: "ADMIN", href: "/admin/prospects", isActive: (pathname) => isAdminWorkspacePath(pathname) || isLegacyMarketToolsPath(pathname) || pathname.startsWith("/dashboard") };

function defaultIsActive(href: string, pathname: string): boolean {
  const targetPath = href;
  if (targetPath === "/") return pathname === "/";
  return pathname === targetPath || pathname.startsWith(targetPath + "/");
}

type Props = {
  sessionUser: SessionUser;
};

export default function AppSwitchNav({ sessionUser }: Props) {
  const pathname = usePathname() || "/";
  const showMarketsSectionSubnav =
    !!sessionUser && canAccessMemberArea(sessionUser) && isMarketsSectionPath(pathname);
  const showLegacyToolsReturn = canAccessMemberArea(sessionUser) && isLegacyMarketToolsPath(pathname);
  const showMarketingQuickLinks = pathname === "/marketing-decks" || pathname.startsWith("/marketing-decks/");
  const links: AppLink[] = [
    MARKETING_LINK,
    REQUEST_ACCESS_LINK,
    LOGIN_LINK,
    PROSPECTS_LINK,
    TEAM_LINK,
    ADMIN_LINK,
  ].filter((link) => canShowNavItem(link.id, sessionUser) && !(link.id === "datastore" && sessionUser?.role === "admin"));
  const onLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
    } catch {
      // Ignore and force new login flow anyway.
    } finally {
      window.location.href = "/auth/login";
    }
  }, []);

  return (
    <div
      data-app-navigation
      style={{
        position: "sticky",
        top: 0,
        zIndex: 1200,
        background: "rgba(248,250,252,0.96)",
        borderBottom: showMarketsSectionSubnav ? undefined : "1px solid rgba(15,23,42,0.08)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "6px 10px",
          borderBottom: showMarketsSectionSubnav ? "1px solid rgba(15,23,42,0.08)" : undefined,
        }}
      >
        <div style={{ width: "100%", maxWidth: 1100, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 8 }}>
            {showMarketingQuickLinks ? (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#475569",
                  whiteSpace: "nowrap",
                }}
              >
                Quick Links:
              </span>
            ) : null}
            {links.map((link) => {
              const active = link.external ? false : link.isActive ? link.isActive(pathname) : defaultIsActive(link.href, pathname);
              const style = {
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: 30,
                padding: "0 10px",
                borderRadius: 999,
                border: "1px solid rgba(15,23,42,0.12)",
                background: active ? "rgba(37,99,235,0.16)" : "rgba(15,23,42,0.04)",
                color: active ? "#1d4ed8" : "#0f172a",
                textDecoration: "none",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.05em",
                whiteSpace: "nowrap",
              } as const;

              if (link.external) {
                return (
                  <a key={link.id} href={link.href} target="_blank" rel="noreferrer" style={style}>
                    {link.label}
                  </a>
                );
              }

              return (
                <Link key={link.id} href={link.href} style={style} aria-current={active ? "page" : undefined}>
                  {link.label}
                </Link>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            {sessionUser ? (
              <button
                type="button"
                onClick={() => void onLogout()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 30,
                  padding: "0 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(15,23,42,0.12)",
                  background: "rgba(15,23,42,0.04)",
                  color: "#0f172a",
                  textDecoration: "none",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
              >
                LOG OUT
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {showLegacyToolsReturn ? (
        <nav aria-label="Legacy tools navigation" className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4">
            <span className="text-xs font-semibold text-slate-500">Legacy market tools</span>
            <Link href={sessionUser?.role === "admin" ? "/admin/prospects" : "/dashboard/targets"} className="font-medium text-slate-700 hover:underline">Back to Prospects</Link>
            {sessionUser?.role === "admin" ? <Link href="/admin/tools" className="font-medium text-slate-700 hover:underline">Admin tools</Link> : null}
          </div>
        </nav>
      ) : null}
      {showMarketsSectionSubnav && sessionUser ? <MarketsSectionSubnav sessionUser={sessionUser} /> : null}
    </div>
  );
}
