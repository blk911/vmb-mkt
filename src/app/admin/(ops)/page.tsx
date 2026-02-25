"use client";

import React from "react";
import AdminShell from "../_components/AdminShell";
import TargetListDrawer from "../_components/TargetListDrawer";
import type { AdminQueryState } from "../_lib/adminQueryState";

export default function AdminOpsPage() {
  const [targetDrawerOpen, setTargetDrawerOpen] = React.useState(false);
  const [initialState] = React.useState<Partial<AdminQueryState>>(() => {
    // Initialize from URL params if needed
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return {
        category: (params.get("category") as any) || "indie",
        search: params.get("search") || undefined,
      };
    }
    return { category: "indie" };
  });

  return (
    <>
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={() => setTargetDrawerOpen(true)}
          className="px-4 py-2 bg-black text-white rounded-lg font-bold hover:bg-neutral-800"
        >
          Target Lists
        </button>
      </div>
      <AdminShell initialState={initialState} />
      <TargetListDrawer open={targetDrawerOpen} onClose={() => setTargetDrawerOpen(false)} />
    </>
  );
}
