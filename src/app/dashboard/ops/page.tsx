"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Report = {
  ok: boolean;
  generatedAt: string;
  summary: {
    listCount: number;
    totalTargets: number;
    pinnedCount: number;
    overdueCount: number;
    unassignedCount: number;
    staleCount: number;
    stageCounts: Record<string, number>;
    dispositionCounts: Record<string, number>;
    ownerCounts: Record<string, number>;
  };
  accessRequests: {
    total: number;
    pending: number;
  };
  lists: Array<{
    id: string;
    name: string;
    updatedAt: string;
    techIds: string[];
    workflow?: {
      owner?: string;
      stage?: string;
      disposition?: string;
      nextActionAt?: string;
      pinned?: boolean;
    };
  }>;
};

function fmtDate(iso?: string) {
  if (!iso) return "Not scheduled";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString();
}

export default function OpsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/dashboard/ops-report", { cache: "no-store" });
        const body = (await res.json()) as Report;
        setReport(body);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const priorityLists = useMemo(() => {
    if (!report?.lists) return [];
    return report.lists
      .filter((list) => {
        const workflow = list.workflow || {};
        return workflow.pinned || !!workflow.nextActionAt || !workflow.owner;
      })
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
      .slice(0, 8);
  }, [report]);

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Ops Queue</h1>
          <div style={{ marginTop: 6, opacity: 0.78, fontSize: 13 }}>
            {loading ? "Refreshing queue summary…" : `Generated ${fmtDate(report?.generatedAt)}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/dashboard/lists" style={{ textDecoration: "none" }}>
            <button>Manage Lists</button>
          </Link>
          <Link href="/access/request" style={{ textDecoration: "none" }}>
            <button>Review Intake Flow</button>
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {[
          { label: "Tracked lists", value: report?.summary.listCount ?? 0 },
          { label: "Targets in workflow", value: report?.summary.totalTargets ?? 0 },
          { label: "Pinned priorities", value: report?.summary.pinnedCount ?? 0 },
          { label: "Due now", value: report?.summary.overdueCount ?? 0 },
          { label: "Unassigned", value: report?.summary.unassignedCount ?? 0 },
          { label: "Pending access requests", value: report?.accessRequests.pending ?? 0 },
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

      <div style={{ marginTop: 14, display: "grid", gap: 14, gridTemplateColumns: "1.1fr 0.9fr" }}>
        <section style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 18, padding: 14, background: "white" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Priority work</h2>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            {priorityLists.map((list) => (
              <div
                key={list.id}
                style={{
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 14,
                  padding: 12,
                  background: "rgba(0,0,0,0.02)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{list.name}</div>
                    <div style={{ marginTop: 4, fontSize: 12, opacity: 0.78 }}>
                      {(list.workflow?.stage || "new").toUpperCase()} · {(list.workflow?.disposition || "open").toUpperCase()} ·{" "}
                      {list.techIds.length} targets
                    </div>
                  </div>
                  {list.workflow?.pinned ? (
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#1d4ed8" }}>PINNED</div>
                  ) : null}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                  Owner: {list.workflow?.owner || "Unassigned"} · Next action: {fmtDate(list.workflow?.nextActionAt)}
                </div>
              </div>
            ))}
            {!priorityLists.length ? <div style={{ opacity: 0.75 }}>No priority lists yet.</div> : null}
          </div>
        </section>

        <section style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 18, padding: 14, background: "white" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Stage coverage</h2>
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {Object.entries(report?.summary.stageCounts || {}).map(([stage, count]) => (
              <div key={stage}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ fontWeight: 700, textTransform: "capitalize" }}>{stage}</span>
                  <span>{count}</span>
                </div>
                <div style={{ marginTop: 6, height: 8, borderRadius: 999, background: "rgba(15,23,42,0.08)" }}>
                  <div
                    style={{
                      width: `${report?.summary.listCount ? Math.max((count / report.summary.listCount) * 100, 6) : 0}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: "#0f172a",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <h2 style={{ margin: "18px 0 0", fontSize: 16, fontWeight: 800 }}>Owner load</h2>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(report?.summary.ownerCounts || {})
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([owner, count]) => (
                <div key={owner} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>{owner}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            {!Object.keys(report?.summary.ownerCounts || {}).length ? (
              <div style={{ fontSize: 13, opacity: 0.75 }}>Assign owners in Lists to balance queue work.</div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
