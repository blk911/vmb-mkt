"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Action = {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

type DashboardCtx = {
  actions: Action[];
  setActions: (actions: Action[]) => void;
  clearActions: () => void;
};

const Ctx = createContext<DashboardCtx | null>(null);

export function useDashboardActions() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDashboardActions must be used inside <DashboardShell>");
  return ctx;
}

function Tab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        padding: "8px 10px",
        borderRadius: 999,
        textDecoration: "none",
        border: "1px solid rgba(0,0,0,0.12)",
        background: active ? "rgba(0,0,0,0.06)" : "white",
        color: "inherit",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {label}
    </Link>
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [actions, setActions] = useState<Action[]>([]);
  const pathname = usePathname() || "";
  const clearActions = useCallback(() => setActions([]), []);

  const ctx = useMemo<DashboardCtx>(() => {
    return {
      actions,
      setActions,
      clearActions,
    };
  }, [actions, clearActions]);

  const tabs = [
    { href: "/dashboard/targets", label: "Targets" },
    { href: "/dashboard/lists", label: "Lists" },
    { href: "/dashboard/data", label: "Data" },
    { href: "/dashboard/ops", label: "Ops" },
  ];

  return (
    <Ctx.Provider value={ctx}>
      <div style={{ padding: 16 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 14px",
            border: "1px solid rgba(0,0,0,0.10)",
            borderRadius: 16,
            background: "white",
          }}
        >
          {/* Left: title + tabs */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 900, letterSpacing: 0.2 }}>VMB Operator</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {tabs.map((t) => (
                <Tab
                  key={t.href}
                  href={t.href}
                  label={t.label}
                  active={pathname === t.href || pathname.startsWith(t.href + "/")}
                />
              ))}
            </div>
          </div>

          {/* Right: actions slot */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {actions.map((a) => (
              <button
                key={a.id}
                onClick={a.onClick}
                disabled={!!a.disabled}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: a.disabled ? "rgba(0,0,0,0.04)" : "white",
                  cursor: a.disabled ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ marginTop: 14 }}>{children}</div>
      </div>
    </Ctx.Provider>
  );
}
