"use client";

import React from "react";
import LeftNavLdap from "./LeftNavLdap";
import TopFiltersBar from "./TopFiltersBar";
import ResultsList from "./ResultsList";
import InspectorPanel from "./InspectorPanel";
import type { AdminQueryState } from "../_lib/adminQueryState";

type AdminShellProps = {
  initialState?: Partial<AdminQueryState>;
};

export default function AdminShell({ initialState }: AdminShellProps) {
  const [state, setState] = React.useState<AdminQueryState>({
    category: "indie",
    ...initialState,
  });

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [pinnedId, setPinnedId] = React.useState<string | null>(null);
  const [activeFacility, setActiveFacility] = React.useState<any | null>(null);

  const [resultCount, setResultCount] = React.useState(0);

  // STEP 4: Load tech roster once (AdminShell)
  const [techById, setTechById] = React.useState<Record<string, any>>({});
  const [techIdsByAddress, setTechIdsByAddress] = React.useState<Record<string, string[]>>({});

  React.useEffect(() => {
    Promise.all([
      fetch("/api/admin/dora/derived/tech_by_id", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/dora/derived/tech_ids_by_address", { cache: "no-store" }).then((r) => r.json()),
    ]).then(([a, b]) => {
      setTechById(a.techById || {});
      setTechIdsByAddress(b.techIdsByAddress || {});
    }).catch((e) => {
      console.error("Failed to load tech roster:", e);
    });
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Nav */}
      <div className="w-64 border-r border-neutral-200 overflow-y-auto">
        <LeftNavLdap state={state} onChange={setState} />
      </div>

      {/* Center */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Filters */}
        <div className="border-b border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-2">
            {/* Step 5: Debug readout */}
            <div className="text-xs opacity-70 font-mono">
              category={state.category} {state.node && `node=${state.node.kind}:${state.node.id}`} rows={resultCount}
            </div>
            <div></div>
          </div>
          <TopFiltersBar
            state={state}
            onChange={setState}
            onSaveView={async () => {
              const name = prompt("Enter target list name:");
              if (!name) return;

              try {
                const res = await fetch("/api/admin/targets/create", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name,
                    scope: state.category.includes("solo") ? "tech" : "facility",
                    savedQuery: state,
                  }),
                });

                const j = await res.json();
                if (j.ok) {
                  alert(`Target list "${name}" created with saved query!`);
                } else {
                  alert(`Error: ${j.error}`);
                }
              } catch (e: any) {
                alert(`Error: ${e?.message}`);
              }
            }}
          />
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto">
          <ResultsList
            state={state}
            activeId={activeId}
            pinnedId={pinnedId}
            onActiveChange={(id, facility) => {
              setActiveId(id);
              setActiveFacility(facility);
            }}
            onPinChange={(id, facility) => {
              setPinnedId(id);
              setActiveFacility(facility);
            }}
            onResultCountChange={setResultCount}
          />
        </div>
      </div>

      {/* Right Inspector */}
      <div className="w-80 border-l border-neutral-200 overflow-y-auto">
        <InspectorPanel
          activeId={activeId || pinnedId}
          state={state}
          activeFacility={activeFacility}
          techById={techById}
          techIdsByAddress={techIdsByAddress}
        />
      </div>
    </div>
  );
}
