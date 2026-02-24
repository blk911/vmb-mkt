"use client";

import React from "react";

type SweepRow = {
  id?: string;
  addressKey?: string;
  placeName?: string;
  decision?: "approve" | "reject" | "skip" | string;
  decisionNote?: string;
  decidedAt?: number;
  addressClass?: string;
  confidence?: number;
  reasons?: string[];
  topCandidate?: any;
  sweepCandidates?: any[];
  geocode?: {
    status?: string;
    formattedAddress?: string;
  };
  context?: {
    doraLicenses?: number | null;
    uniqueTechs?: number | null;
    activeCount?: number | null;
    hasAcceptedFacility?: boolean;
    facilityBrand?: string | null;
  };
  adjudication?: {
    decision?: string | null;
    decidedAt?: string | null;
  };
};

type SweepGetResp = {
  ok: boolean;
  counts?: Record<string, number>;
  rows?: SweepRow[];
  updatedAt?: string;
  error?: string;
};

export default function PlacesSweepClient() {
  const [loading, setLoading] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [cls, setCls] = React.useState("all");
  const [data, setData] = React.useState<SweepGetResp | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [limit, setLimit] = React.useState<number>(50);

  async function safeJson(res: Response) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        `API did not return JSON. status=${res.status} content-type=${res.headers.get("content-type")} bodyHead=${text.slice(0, 120)}`
      );
    }
  }

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/vmb/places/candidates", { cache: "no-store" });
      const j = (await safeJson(r)) as { rows?: SweepRow[]; count?: number; error?: string };
      if (!r.ok) throw new Error(j?.error || `request_failed_status_${r.status}`);
      const rows = Array.isArray(j?.rows) ? j.rows : [];
      setData({
        ok: true,
        rows,
        counts: { rows: Number(j?.count ?? rows.length) },
        updatedAt: new Date().toISOString(),
      });
    } catch (e: any) {
      setErr(e?.message || "refresh_failed");
    } finally {
      setLoading(false);
    }
  }

  async function runSweep() {
    setRunning(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/vmb/places/run-sweep", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit }),
      });
      const json = await safeJson(res);
      if (!res.ok || !json?.ok) throw new Error(json?.error || `request_failed_status_${res.status}`);
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "run_failed");
    } finally {
      setRunning(false);
    }
  }

  async function decide(row: SweepRow, decision: "approve" | "reject" | "skip", note = "") {
    setErr(null);
    try {
      const id = String(row?.id || "").trim();
      if (!id) throw new Error("Missing row.id for decision write");
      const body: any = { id, decision, note };

      const r = await fetch("/api/admin/vmb/places/decide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await safeJson(r);
      if (!r.ok || !json?.ok) throw new Error(json?.error || `request_failed_status_${r.status}`);
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "decide_failed");
    }
  }

  React.useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = (data?.rows || [])
    .filter((r) => {
      if (!q.trim()) return true;
      const hay = JSON.stringify(r).toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    })
    .filter((r) => {
      if (cls === "all") return true;
      return (r.addressClass || "unknown") === cls;
    });

  const counts = data?.counts || {};

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Places Sweep</h1>
      <div style={{ opacity: 0.8, marginBottom: 16 }}>
        rows: {counts.rows ?? rows.length} · storefront: {counts.storefront ?? 0} · suite_center:{" "}
        {counts.suite_center ?? 0} · maildrop: {counts.maildrop ?? 0} · residential:{" "}
        {counts.residential ?? 0} · unknown: {counts.unknown ?? 0}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search address / candidate..."
          style={{ padding: "8px 10px", minWidth: 280 }}
        />
        <select value={cls} onChange={(e) => setCls(e.target.value)} style={{ padding: "8px 10px" }}>
          <option value="all">All classes</option>
          <option value="storefront">storefront</option>
          <option value="suite_center">suite_center</option>
          <option value="maildrop">maildrop</option>
          <option value="residential">residential</option>
          <option value="unknown">unknown</option>
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          limit
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value || "50", 10))}
            style={{ width: 90, padding: "8px 10px" }}
          />
        </label>

        <button onClick={refresh} disabled={loading} style={{ padding: "8px 12px" }}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>

        <button onClick={runSweep} disabled={running} style={{ padding: "8px 12px", fontWeight: 700 }}>
          {running ? "Running..." : "Run Sweep"}
        </button>
      </div>

      {err && (
        <div style={{ background: "#ffecec", border: "1px solid #ffb3b3", padding: 12, marginBottom: 16 }}>
          {err}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((r) => {
          const candidates = r.sweepCandidates || [];
          const top = r.topCandidate || null;
          const label = r.addressKey || r.placeName || r.id || "(unlabeled row)";

          return (
            <div key={r.id || r.addressKey || label} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700 }}>{label}</div>
                <div style={{ opacity: 0.85 }}>
                  class: <b>{r.addressClass || "unknown"}</b> · conf: {r.confidence ?? ""}
                </div>
              </div>

              {(r.decision || r.decidedAt) && (
                <div style={{ marginTop: 6, opacity: 0.85 }}>
                  decision: <b>{r.decision || "—"}</b> {r.decidedAt ? `· decidedAt ${new Date(r.decidedAt).toLocaleString()}` : ""}
                </div>
              )}

              <div style={{ marginTop: 6, opacity: 0.85 }}>
                reasons: {(r.reasons || []).join(", ") || "—"}
              </div>

              <div style={{ marginTop: 6, opacity: 0.85 }}>
                dora: licenses {r.context?.doraLicenses ?? "—"} · unique {r.context?.uniqueTechs ?? "—"} · active{" "}
                {r.context?.activeCount ?? "—"}
              </div>

              <div style={{ marginTop: 12, fontWeight: 700 }}>Candidates</div>
              {candidates.length === 0 ? (
                <div style={{ marginTop: 6, opacity: 0.75 }}>No candidates (no external hits).</div>
              ) : (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                  {candidates.slice(0, 6).map((c: any, idx: number) => (
                    <div key={idx} style={{ border: "1px dashed #ccc", borderRadius: 8, padding: 10 }}>
                      <div style={{ fontWeight: 700 }}>{c?.name || c?.placeName || "(no name)"}</div>
                      <div style={{ opacity: 0.85 }}>
                        {c?.formattedAddress || c?.vicinity || ""} {c?.types ? `· ${c.types.join(", ")}` : ""}
                      </div>
                      <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          onClick={() => decide(r, "approve", `candidate:${c?.name || c?.placeName || "unknown"}`)}
                          style={{ padding: "6px 10px" }}
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => decide(r, "approve")} style={{ padding: "6px 10px" }}>
                  Approve
                </button>
                <button onClick={() => decide(r, "skip")} style={{ padding: "6px 10px" }}>
                  Skip
                </button>
                <button onClick={() => decide(r, "reject")} style={{ padding: "6px 10px" }}>
                  Reject
                </button>
              </div>

              {top && (
                <div style={{ marginTop: 10, opacity: 0.9 }}>
                  top: <b>{top?.name || top?.placeName}</b>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
