"use client";

import React from "react";

type TechRow = {
  techId: string;
  licenseNumber: string;
  name: string;
  homeRollupKey?: string;
  primaryRollupKey?: string;
  salonCount?: number;
  mobilityFlag?: boolean;
  signals?: {
    totalScore?: number;
    demand?: number;
    density?: number;
    network?: number;
    mobility?: number;
    stability?: number;
  };
};

export default function TechTargetingClient() {
  const [loading, setLoading] = React.useState(false);
  const [rows, setRows] = React.useState<TechRow[]>([]);
  const [explainTechId, setExplainTechId] = React.useState<string | null>(null);
  const [explain, setExplain] = React.useState<any>(null);
  const [explainLoading, setExplainLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/dora/truth/tech/index?sort=totalDesc&pageSize=100", {
          cache: "no-store",
        });
        const j = await res.json();
        if (cancelled) return;
        if (j.ok) {
          setRows(j.rows || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const openExplain = async (techId: string) => {
    setExplainTechId(techId);
    setExplainLoading(true);
    try {
      const res = await fetch(`/api/admin/dora/truth/tech/explain/${encodeURIComponent(techId)}`, {
        cache: "no-store",
      });
      const j = await res.json();
      if (j.ok) {
        setExplain(j.explain);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setExplainLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Tech Targeting</h1>

      {loading && <div className="p-4">Loading…</div>}

      <div className="border rounded overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-white border-b">
            <tr className="text-left">
              <th className="p-2">Why</th>
              <th className="p-2">License</th>
              <th className="p-2">Name</th>
              <th className="p-2">Home</th>
              <th className="p-2">Primary</th>
              <th className="p-2">SalonCt</th>
              <th className="p-2">Mob?</th>
              <th className="p-2">Total</th>
              <th className="p-2">Demand</th>
              <th className="p-2">Density</th>
              <th className="p-2">Network</th>
              <th className="p-2">Mobility</th>
              <th className="p-2">Stability</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const sig = r.signals || ({} as any);
              return (
                <tr key={r.techId} className="border-b hover:bg-gray-50">
                  <td className="p-2">
                    <button
                      className="px-2 py-1 rounded border"
                      onClick={() => openExplain(r.techId)}
                    >
                      Why?
                    </button>
                  </td>
                  <td className="p-2 font-mono">{r.licenseNumber || ""}</td>
                  <td className="p-2">{r.name || ""}</td>
                  <td className="p-2">{r.homeRollupKey || ""}</td>
                  <td className="p-2">{r.primaryRollupKey || ""}</td>
                  <td className="p-2">{r.salonCount ?? 0}</td>
                  <td className="p-2">{r.mobilityFlag ? "Y" : ""}</td>
                  <td className="p-2 font-semibold">{sig.totalScore ?? ""}</td>
                  <td className="p-2">{sig.demand ?? ""}</td>
                  <td className="p-2">{sig.density ?? ""}</td>
                  <td className="p-2">{sig.network ?? ""}</td>
                  <td className="p-2">{sig.mobility ?? ""}</td>
                  <td className="p-2">{sig.stability ?? ""}</td>
                </tr>
              );
            })}
            {!rows.length && !loading && (
              <tr>
                <td className="p-3 opacity-70" colSpan={13}>
                  No rows.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Explain Modal */}
      {explainTechId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-3xl">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="font-semibold">Explain: {explainTechId}</div>
              <button
                className="px-2 py-1 rounded border"
                onClick={() => {
                  setExplainTechId(null);
                  setExplain(null);
                }}
              >
                Close
              </button>
            </div>
            <div className="p-4 text-sm space-y-2 max-h-[70vh] overflow-auto">
              {explainLoading && <div>Loading…</div>}
              {!explainLoading && (
                <pre className="whitespace-pre-wrap break-words">
                  {JSON.stringify(explain, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
