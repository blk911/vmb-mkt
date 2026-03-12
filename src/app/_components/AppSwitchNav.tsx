"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback } from "react";
import { canShowNavItem, type SessionUser } from "@/lib/auth/access";

type AppLink = {
  id: string;
  label: string;
  href: string;
};

const MARKETING_LINK: AppLink = { id: "marketing", label: "MARKETING", href: "/marketing-decks" };
const REQUEST_ACCESS_LINK: AppLink = { id: "request_access", label: "REQUEST ACCESS", href: "/access/request" };
const LOGIN_LINK: AppLink = { id: "login", label: "LOGIN", href: "/auth/login" };
const MARKETS_LINK: AppLink = { id: "markets", label: "MARKETS", href: "/admin/markets" };
const LIVE_UNITS_LINK: AppLink = { id: "liveunits", label: "LIVE UNITS", href: "/admin/live-units" };
const DATASTORE_LINK: AppLink = { id: "datastore", label: "DATA STORE", href: "/dashboard/targets" };
const TEAM_LINK: AppLink = { id: "team", label: "TEAM", href: "/team" };
const ADMIN_LINK: AppLink = { id: "admin", label: "ADMIN", href: "/admin" };

function isActive(href: string, pathname: string): boolean {
  const targetPath = href;
  if (targetPath === "/") return pathname === "/";
  return pathname === targetPath || pathname.startsWith(targetPath + "/");
}

type Props = {
  sessionUser: SessionUser;
};

export default function AppSwitchNav({ sessionUser }: Props) {
  const pathname = usePathname() || "/";
  const showMarketingQuickLinks = pathname === "/marketing-decks" || pathname.startsWith("/marketing-decks/");
  const links: AppLink[] = [
    MARKETING_LINK,
    REQUEST_ACCESS_LINK,
    LOGIN_LINK,
    MARKETS_LINK,
    LIVE_UNITS_LINK,
    DATASTORE_LINK,
    TEAM_LINK,
    ADMIN_LINK,
  ].filter((link) => canShowNavItem(link.id, sessionUser));
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
      style={{
        position: "sticky",
        top: 0,
        zIndex: 1200,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "6px 10px",
        background: "rgba(248,250,252,0.96)",
        borderBottom: "1px solid rgba(15,23,42,0.08)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 1100, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
        <div />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
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
            const active = isActive(link.href, pathname);
            return (
              <Link
                key={link.id}
                href={link.href}
                style={{
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
                }}
              >
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
  );
}

