"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import PipelineNav from "@/components/admin/PipelineNav";

type Action = { id: string; label: string; onClick: () => void; disabled?: boolean };
type DashboardCtx = { actions: Action[]; setActions: (actions: Action[]) => void; clearActions: () => void };
const Ctx = createContext<DashboardCtx | null>(null);

export function useDashboardActions() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDashboardActions must be used inside <DashboardShell>");
  return ctx;
}

export default function DashboardShell({ children, member = true }: { children: React.ReactNode; member?: boolean }) {
  const [actions, setActions] = useState<Action[]>([]);
  const clearActions = useCallback(() => setActions([]), []);
  const ctx = useMemo<DashboardCtx>(() => ({ actions, setActions, clearActions }), [actions, clearActions]);
  return <Ctx.Provider value={ctx}>
    <div className="min-h-screen bg-gray-50">
      <PipelineNav member={member} />
      {actions.length ? <div className="flex flex-wrap justify-end gap-2 px-6 pt-4">{actions.map((action) => (
        <button key={action.id} type="button" onClick={action.onClick} disabled={action.disabled} className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50">{action.label}</button>
      ))}</div> : null}
      <div className="p-6">{children}</div>
    </div>
  </Ctx.Provider>;
}
