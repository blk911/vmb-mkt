"use client";

import React from "react";
import type { AdminQueryState } from "../_lib/adminQueryState";

type InspectorPanelProps = {
  activeId: string | null;
  state: AdminQueryState;
  activeFacility?: {
    addressId?: string;
    addressKey?: string;
    [key: string]: any;
  } | null;
  techById: Record<string, any>;
  techIdsByAddress: Record<string, string[]>;
};

export default function InspectorPanel({
  activeId,
  state,
  activeFacility,
  techById,
  techIdsByAddress,
}: InspectorPanelProps) {
  const [data, setData] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"summary" | "license" | "roster" | "marketing">("summary");
  const [activeTechId, setActiveTechId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!activeId) {
      setData(null);
      setActiveTechId(null);
      return;
    }

    let alive = true;
    (async () => {
      try {
        setLoading(true);
        // Use activeFacility data if available, otherwise fetch
        if (activeFacility) {
          setData(activeFacility);
        } else {
          // TODO: Fetch detail data based on activeId and state.category
          // For now, stub
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (!alive) return;
          setData({ id: activeId, name: "Sample Item" });
        }
      } catch (e: any) {
        if (!alive) return;
        console.error("Inspector fetch error:", e);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [activeId, activeFacility, state.category]);

  // STEP 5: Compute addressId and techIds for roster
  const addressId = activeFacility?.addressId || activeFacility?.addressKey || null;
  const techIds = addressId ? techIdsByAddress[addressId] || [] : [];

  if (!activeId) {
    return (
      <div className="p-6 text-center opacity-50">
        Hover or click a result to view details
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-center opacity-70">
        Loading...
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <div className="text-lg font-bold">{data?.name || "Unknown"}</div>
        <div className="text-xs opacity-70 mt-1">ID: {activeId}</div>
      </div>

      <div className="border-b border-neutral-200 mb-4">
        <div className="flex gap-2">
          {(["summary", "license", "roster", "marketing"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-sm font-bold border-b-2 ${
                activeTab === tab
                  ? "border-black"
                  : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {activeTab === "summary" && (
          <div className="text-sm">
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div>
                <div className="text-xs opacity-70">City</div>
                <div className="font-bold">{data?.city || "—"}</div>
              </div>
              <div>
                <div className="text-xs opacity-70">Size Band</div>
                <div className="font-bold">{data?.sizeBand || "—"}</div>
              </div>
            </div>
            {/* Add more summary fields */}
          </div>
        )}

        {activeTab === "license" && (
          <div className="text-sm opacity-70">
            License details (stub)
          </div>
        )}

        {activeTab === "roster" && (
          <TechRosterView
            activeFacility={activeFacility}
            techById={techById}
            techIdsByAddress={techIdsByAddress}
            activeTechId={activeTechId}
            onTechClick={setActiveTechId}
          />
        )}

        {activeTab === "marketing" && (
          <div className="text-sm opacity-70">
            Marketing info (stub)
          </div>
        )}
      </div>

      {/* Tech Detail Panel */}
      {activeTechId && techById[activeTechId] && (
        <TechDetailPanel
          tech={techById[activeTechId]}
          onClose={() => setActiveTechId(null)}
        />
      )}

      {/* STEP 6: Temp debug line (MANDATORY) */}
      <div className="text-[10px] opacity-40 mt-2">
        addressId={addressId || "none"} • techIds={techIds.length}
      </div>
    </div>
  );
}

function TechRosterView({
  activeFacility,
  techById,
  techIdsByAddress,
  activeTechId,
  onTechClick,
}: {
  activeFacility?: { addressId?: string; addressKey?: string; [key: string]: any } | null;
  techById: Record<string, any>;
  techIdsByAddress: Record<string, string[]>;
  activeTechId: string | null;
  onTechClick: (id: string | null) => void;
}) {
  // STEP 5: Determine addressId from facility
  const addressId = activeFacility?.addressId || activeFacility?.addressKey || null;

  if (!addressId) {
    return (
      <div className="text-sm opacity-60">
        No address ID available for this facility.
      </div>
    );
  }

  const techIds = techIdsByAddress[addressId] || [];
  const techs = techIds.map((id) => techById[id]).filter(Boolean);

  return (
    <section>
      <h3 className="font-semibold">
        Techs at this address ({techs.length})
      </h3>

      {techs.length === 0 ? (
        <div className="text-sm opacity-60">
          No tech roster found for this address.
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {techs.slice(0, 25).map((t) => (
            <div
              key={t.licenseId}
              className={`rounded border p-2 text-sm cursor-pointer hover:bg-neutral-50 transition-colors ${
                activeTechId === t.licenseId ? "bg-neutral-100 border-black" : "border-neutral-200"
              }`}
              onClick={() => onTechClick(activeTechId === t.licenseId ? null : t.licenseId)}
            >
              <div className="font-medium">{t.name}</div>
              <div className="opacity-70">
                {t.licenseType} • {t.status} • exp {t.expireDate || "?"}
              </div>
            </div>
          ))}
          {techs.length > 25 && (
            <div className="text-xs opacity-70">
              Showing first 25 (PH1). Add "Show all" later.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function TechDetailPanel({
  tech,
  onClose,
}: {
  tech: TechMini;
  onClose: () => void;
}) {
  return (
    <div className="mt-4 border-t border-neutral-200 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold">Tech Details</h4>
        <button
          onClick={onClose}
          className="text-xs opacity-70 hover:opacity-100"
        >
          Close
        </button>
      </div>
      <div className="space-y-2 text-sm">
        <div>
          <div className="text-xs opacity-70">Name</div>
          <div className="font-bold">{tech.name}</div>
        </div>
        <div>
          <div className="text-xs opacity-70">License ID</div>
          <div className="font-mono">{tech.licenseId}</div>
        </div>
        <div>
          <div className="text-xs opacity-70">License Type</div>
          <div>{tech.licenseType}</div>
        </div>
        <div>
          <div className="text-xs opacity-70">Status</div>
          <div>{tech.status}</div>
        </div>
        {tech.expireDate && (
          <div>
            <div className="text-xs opacity-70">Expiration Date</div>
            <div>{tech.expireDate}</div>
          </div>
        )}
        {tech.renewBy && (
          <div>
            <div className="text-xs opacity-70">Renew By</div>
            <div>{tech.renewBy}</div>
          </div>
        )}
        {tech.city && (
          <div>
            <div className="text-xs opacity-70">Location</div>
            <div>{tech.city}, {tech.state} {tech.zip}</div>
          </div>
        )}
      </div>
    </div>
  );
}
