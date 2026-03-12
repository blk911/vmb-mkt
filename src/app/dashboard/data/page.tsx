"use client";

import { useEffect, useState } from "react";

type Report = {
  ok: boolean;
  generatedAt: string;
  summary: {
    staleCount: number;
    unassignedCount: number;
    dispositionCounts: Record<string, number>;
  };
  accessRequests: {
    total: number;
    pending: number;
  };
};

type HighLevelPreview = {
  ok: boolean;
  payload: {
    generatedAt: string;
    listCount: number;
    totalTargets: number;
    lists: Array<{
      id: string;
      name: string;
      owner: string;
      stage: string;
      disposition: string;
      nextActionAt: string;
      targetCount: number;
      updatedAt: string;
    }>;
  };
};

function fmtDate(iso?: string) {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString();
}

export default function DataPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [preview, setPreview] = useState<HighLevelPreview | null>(null);

  useEffect(() => {
    (async () => {
      const [reportRes, previewRes] = await Promise.all([
        fetch("/api/dashboard/ops-report", { cache: "no-store" }),
        fetch("/api/integrations/highlevel/preview", { cache: "no-store" }),
      ]);
      setReport((await reportRes.json()) as Report);
      setPreview((await previewRes.json()) as HighLevelPreview);
    })();
  }, []);

  return (
    <div style={{ padding: 12 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Data Control + Reporting</h1>
      <div style={{ marginTop: 8, opacity: 0.78, fontSize: 13 }}>
        Shared workflow health, intake visibility, and HighLevel handoff readiness for the internal app.
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {[
          { label: "Pending access requests", value: report?.accessRequests.pending ?? 0 },
          { label: "Stale workflow lists", value: report?.summary.staleCount ?? 0 },
          { label: "Unassigned lists", value: report?.summary.unassignedCount ?? 0 },
          { label: "HighLevel-ready lists", value: preview?.payload.listCount ?? 0 },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              border: "1px solid rgba(0,0,0,0.10)",
              borderRadius: 18,
              padding: 14,
              background: "white",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.72 }}>{card.label}</div>
            <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900 }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
        <section style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 18, padding: 14, background: "white" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Disposition mix</h2>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(report?.summary.dispositionCounts || {}).map(([key, value]) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ textTransform: "capitalize" }}>{key}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18, fontSize: 12, opacity: 0.76 }}>
            Report generated: {fmtDate(report?.generatedAt)}
          </div>
        </section>

        <section style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 18, padding: 14, background: "white" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>HighLevel handoff preview</h2>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
            Ready-to-sync lists are pulled from workflow stages `qualified` and `handoff`.
          </div>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            {(preview?.payload.lists || []).slice(0, 6).map((list) => (
              <div
                key={list.id}
                style={{
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 14,
                  padding: 12,
                  background: "rgba(0,0,0,0.02)",
                }}
              >
                <div style={{ fontWeight: 800 }}>{list.name}</div>
                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
                  {list.stage.toUpperCase()} · {list.disposition.toUpperCase()} · {list.targetCount} targets
                </div>
                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.72 }}>
                  Owner: {list.owner || "Unassigned"} · Next action: {fmtDate(list.nextActionAt) || "Not scheduled"}
                </div>
              </div>
            ))}
            {!preview?.payload.lists?.length ? (
              <div style={{ fontSize: 13, opacity: 0.75 }}>
                No lists are staged for HighLevel handoff yet. Update workflow stage in Lists to qualify them.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
