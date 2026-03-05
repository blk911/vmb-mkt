"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback } from "react";

type AppLink = {
  id: string;
  label: string;
  href: string;
};

const MARKETING_LINK: AppLink = { id: "marketing", label: "MARKETING", href: "/marketing-decks" };
const DATASTORE_LINK: AppLink = { id: "datastore", label: "DATA STORE", href: "/dashboard/targets" };
const TEAM_LINK: AppLink = { id: "team", label: "TEAM", href: "https://vmb-team-planner.vercel.app/" };

const LINKS: AppLink[] = [
  MARKETING_LINK,
  DATASTORE_LINK,
  TEAM_LINK,
];

function isActive(href: string, pathname: string): boolean {
  const targetPath = href;
  if (targetPath === "/") return pathname === "/";
  return pathname === targetPath || pathname.startsWith(targetPath + "/");
}

export default function AppSwitchNav() {
  const pathname = usePathname() || "/";
  if (pathname.startsWith("/auth/login")) return null;
  const links = LINKS;
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
        </div>
      </div>
    </div>
  );
}

