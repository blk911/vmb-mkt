"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AppLink = {
  id: string;
  label: string;
  href: string;
};

const MARKETING_LINK: AppLink = { id: "marketing", label: "MARKETING", href: "https://vmb-mkt.vercel.app/marketing-decks" };
const DATASTORE_LINK: AppLink = { id: "datastore", label: "DATA STORE", href: "https://vmb-mkt.vercel.app/dashboard/targets" };

const LINKS: AppLink[] = [
  MARKETING_LINK,
  DATASTORE_LINK,
];

const MKT_HOST = "vmb-mkt.vercel.app";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

function sameAppHost(hostname: string) {
  return hostname === MKT_HOST || LOCAL_HOSTS.has(hostname);
}

function normalizePathForLocal(pathname: string) {
  return pathname;
}

function pathFromHref(href: string): string | null {
  try {
    const target = new URL(href);
    if (!sameAppHost(target.hostname)) return null;
    return normalizePathForLocal(target.pathname);
  } catch {
    return null;
  }
}

function isActive(href: string, pathname: string): boolean {
  const targetPath = pathFromHref(href);
  if (!targetPath) return false;
  if (targetPath === "/") return pathname === "/";
  return pathname === targetPath || pathname.startsWith(targetPath + "/");
}

export default function AppSwitchNav() {
  const pathname = usePathname() || "/";
  if (pathname.startsWith("/auth/login")) return null;
  const links = LINKS;

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
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
    </div>
  );
}

