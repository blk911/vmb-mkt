"use client";

import React, { useEffect, useMemo, useState } from "react";

type Row = any;

export default function PlacesReviewClient() {
  const [resp, setResp] = useState<any>(null);
  const [q, setQ] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [busyBulk, setBusyBulk] = useState(false);
  const [filter, setFilter] = useState<
    "unreviewed" | "accepted" | "rejected" | "defer" | "all"
  >("unreviewed");

  async function load() {
    const r = await fetch("/api/admin/places/review", { cache: "no-store" });
    const j = await r.json();
    setResp(j);
  }

  useEffect(() => {
    load();
  }, []);

  const rows: Row[] = Array.isArray(resp?.rows) ? resp.rows : [];

  const filtered = useMemo(() => {
    const s = q.trim().toUpperCase();
    return rows.filter((r) => {
      const dec = r?.adjudication?.decision ?? "unreviewed";
      if (filter !== "all" && dec !== filter) return false;

      if (!s) return true;
      const hay =
        `${r?.addressKey ?? ""} ${r?.placeName ?? ""} ${r?.facility?.displayName ?? ""} ${r?.facility?.brand ?? ""}`.toUpperCase();
      return hay.includes(s);
    });
  }, [rows, q, filter]);

  async function decide(
    addressKey: string,
    decision: "accepted" | "rejected" | "defer",
    note = ""
  ) {
    setBusyKey(addressKey);
    try {
      const r = await fetch("/api/admin/places/review/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressKey, decision, note }),
      });
      const j = await r.json();
      if (!j?.ok) {
        alert(j?.error || "Decision failed");
        return;
      }
      await load();
    } finally {
      setBusyKey(null);
    }
  }

  async function bulk(action: "accept_facility_exact" | "reject_dead") {
    const ok = window.confirm(
      action === "accept_facility_exact"
        ? "Bulk ACCEPT all facility-overlay exact rows?"
        : "Bulk REJECT all dead rows (no facility + no place fields + score 0)?"
    );
    if (!ok) return;

    setBusyBulk(true);
    try {
      const r = await fetch("/api/admin/places/review/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await r.json();
      if (!j?.ok) {
        alert(j?.error || "Bulk failed");
        return;
      }
      await load();
    } finally {
      setBusyBulk(false);
    }
  }

  async function createFacilityTargetList() {
    const name = window.prompt(
      "New facility target list name?",
      `great-clips-${new Date().toISOString().slice(0, 10)}`
    );
    if (!name) return;

    const onlyBrand =
      window.prompt("Optional brand filter (exact match) or leave blank:", "Great Clips") || "";

    setBusyBulk(true);
    try {
      const r = await fetch("/api/admin/places/review/create-facility-target-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, onlyBrand: onlyBrand.trim() }),
      });
      const j = await r.json();
      if (!j?.ok) {
        alert(j?.error || "Create list failed");
        return;
      }
      alert(`Created: ${j.created.name} (${j.itemsAdded} items)`);
    } finally {
      setBusyBulk(false);
    }
  }

  const counts = resp?.counts ?? {};

  return (
    <div style={{ padding: 20, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Places Review</h1>
      <div style={{ opacity: 0.75, marginTop: 6 }}>
        rows: <b>{counts.rows ?? rows.length}</b> · unreviewed: <b>{counts.unreviewed ?? "-"}</b> ·
        accepted: <b>{counts.accepted ?? "-"}</b> · rejected: <b>{counts.rejected ?? "-"}</b> ·
        defer: <b>{counts.defer ?? "-"}</b>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search address / brand / label..."
          style={{ padding: 10, border: "1px solid #ddd", borderRadius: 10, minWidth: 320 }}
        />

        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} style={{ padding: 10, borderRadius: 10 }}>
          <option value="unreviewed">Unreviewed</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="defer">Defer</option>
          <option value="all">All</option>
        </select>

        <button onClick={load} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}>
          Refresh
        </button>
        <button
          disabled={busyBulk}
          onClick={() => bulk("accept_facility_exact")}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", fontWeight: 700 }}
        >
          Bulk Accept (Facility Exact)
        </button>
        <button
          disabled={busyBulk}
          onClick={() => bulk("reject_dead")}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
        >
          Bulk Reject (Dead Rows)
        </button>
        <button
          disabled={busyBulk}
          onClick={createFacilityTargetList}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", fontWeight: 700 }}
        >
          Create Facility Target List (Accepted)
        </button>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {filtered.map((r) => {
          const ak = String(r?.addressKey || "");
          const dec = r?.adjudication?.decision ?? "unreviewed";
          const fac = r?.facility;

          return (
            <div key={ak} style={{ border: "1px solid #e7e7e7", borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{fac?.displayName || r?.placeName || "Unknown"}</div>
                  <div style={{ opacity: 0.75, marginTop: 4 }}>{ak}</div>

                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, border: "1px solid #ddd" }}>
                      decision: <b>{dec}</b>
                    </span>
                    {fac?.category ? (
                      <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, border: "1px solid #ddd" }}>
                        {fac.category}
                      </span>
                    ) : null}
                    {fac?.matchMode ? (
                      <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, border: "1px solid #ddd" }}>
                        facilityMatch: <b>{fac.matchMode}</b>
                      </span>
                    ) : null}
                    <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, border: "1px solid #ddd" }}>
                      matchScore: <b>{r?.matchScore ?? 0}</b>
                    </span>
                    {r?.source ? (
                      <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, border: "1px solid #ddd" }}>
                        source: {r.source}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button
                    disabled={!!busyKey}
                    onClick={() => decide(ak, "accepted")}
                    style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", fontWeight: 700 }}
                    title="Accept (use facility overlay as truth)"
                  >
                    Accept
                  </button>
                  <button
                    disabled={!!busyKey}
                    onClick={() => decide(ak, "defer")}
                    style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
                  >
                    Defer
                  </button>
                  <button
                    disabled={!!busyKey}
                    onClick={() => decide(ak, "rejected")}
                    style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
                  >
                    Reject
                  </button>
                </div>
              </div>

              {fac ? (
                <div style={{ marginTop: 10, opacity: 0.9, fontSize: 13 }}>
                  <b>Facility:</b> {fac.brand} · {fac.displayName}
                </div>
              ) : null}

              {r?.website || r?.phone || r?.googleUrl ? (
                <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
                  {r?.phone ? (
                    <div>
                      <b>Phone:</b> {r.phone}
                    </div>
                  ) : null}
                  {r?.website ? (
                    <div>
                      <b>Website:</b> {r.website}
                    </div>
                  ) : null}
                  {r?.googleUrl ? (
                    <div>
                      <b>Google:</b> {r.googleUrl}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
