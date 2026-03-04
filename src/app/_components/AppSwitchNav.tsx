"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AppLink = {
  id: string;
  label: string;
  href: string;
};

const LINKS: AppLink[] = [
  { id: "team", label: "TEAM", href: "https://vmb-team-planner.vercel.app/" },
  { id: "marketing", label: "MARKETING", href: "https://vmb-mkt.vercel.app/marketing-decks" },
  { id: "datastore", label: "DATA STORE", href: "https://vmb-mkt.vercel.app/dashboard/targets" },
];

function isActive(href: string, pathname: string): boolean {
  try {
    const target = new URL(href);
    if (target.hostname !== "vmb-mkt.vercel.app") return false;
    if (target.pathname === "/") return pathname === "/";
    return pathname === target.pathname || pathname.startsWith(target.pathname + "/");
  } catch {
    return false;
  }
}

export default function AppSwitchNav() {
  const pathname = usePathname() || "/";

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
        {LINKS.map((link) => {
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

