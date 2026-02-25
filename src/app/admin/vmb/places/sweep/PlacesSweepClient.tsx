"use client";

import React, { useEffect, useMemo, useState } from "react";

type Row = any;

export default function PlacesSweepClient() {
  const [resp, setResp] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [q, setQ] = useState("");
  const [classFilter, setClassFilter] = useState<
    "all" | "storefront" | "suite_center" | "maildrop" | "residential" | "unknown"
  >("all");
  const [selectedByAk, setSelectedByAk] = useState<Record<string, string>>({});
  const [busyAk, setBusyAk] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/places/sweep", { cache: "no-store" });
      const j = await r.json();
      setResp(j);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function runSweep() {
    setRunning(true);
    try {
      const r = await fetch("/api/admin/places/sweep/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!j?.ok) {
        alert(j?.error || "Sweep run failed");
        return;
      }
      await load();
    } finally {
      setRunning(false);
    }
  }

  async function runTopDensitySweep() {
    setRunning(true);
    try {
      const tRes = await fetch("/api/derived/tech-index?lite=1", { cache: "no-store" });
      const tJson = await tRes.json();
      const techRows: any[] = Array.isArray(tJson?.tech) ? tJson.tech : [];
      const topAddressKeys = techRows
        .slice()
        .sort((a, b) => {
          const av = Number(a?.techSignals?.doraLicenses ?? a?.techSignals?.techCountLicenses ?? 0) || 0;
          const bv = Number(b?.techSignals?.doraLicenses ?? b?.techSignals?.techCountLicenses ?? 0) || 0;
          return bv - av;
        })
        .map((r) => String(r?.addressKey || "").trim())
        .filter(Boolean)
        .slice(0, 25);

      if (!topAddressKeys.length) {
        alert("No address keys found in tech index.");
        return;
      }

      const r = await fetch("/api/admin/places/sweep/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressKeys: topAddressKeys }),
      });
      const j = await r.json();
      if (!j?.ok) {
        alert(j?.error || "Top density sweep failed");
        return;
      }
      await load();
    } finally {
      setRunning(false);
    }
  }

  async function postBulk(action: string, extra?: any) {
    const res = await fetch("/api/admin/places/sweep/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...(extra || {}) }),
    });
    const j = await res.json();
    if (!j?.ok) throw new Error(j?.error || "bulk_failed");
    return j;
  }

  async function decide(addressKey: string, decision: string, selectedCandidate?: any) {
    setBusyAk(addressKey);
    try {
      const r = await fetch("/api/admin/places/sweep/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressKey,
          decision,
          selectedCandidatePlaceId: selectedCandidate?.placeId || "",
          selectedCandidateName: selectedCandidate?.name || "",
        }),
      });
      const j = await r.json();
      if (!j?.ok) {
        alert(j?.error || "Decision failed");
        return;
      }
      await load();
    } finally {
      setBusyAk(null);
    }
  }

  const rows: Row[] = Array.isArray(resp?.rows) ? resp.rows : [];
  const counts = resp?.counts || {};

  const filtered = useMemo(() => {
    const s = q.trim().toUpperCase();
    return rows.filter((r) => {
      const klass = String(r?.effectiveAddressClass || r?.addressClass || "unknown");
      if (classFilter !== "all" && klass !== classFilter) return false;
      if (!s) return true;
      const hay = `${r?.addressKey || ""} ${r?.topCandidate?.name || ""} ${(r?.sweepCandidates || [])
        .map((x: any) => x?.name || "")
        .join(" ")}`.toUpperCase();
      return hay.includes(s);
    });
  }, [rows, q, classFilter]);

  return (
    <div style={{ padding: 20, maxWidth: 1200 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Address Sweep</h1>
      <div style={{ opacity: 0.75, marginTop: 6 }}>
        rows: <b>{counts.rows ?? rows.length}</b> · confirmed: <b>{counts.confirmedCandidate ?? "-"}</b> · suite:{" "}
        <b>{counts.manualSuiteCenter ?? "-"}</b> · residential: <b>{counts.manualResidential ?? "-"}</b> · unknown:{" "}
        <b>{counts.manualUnknown ?? "-"}</b> · unreviewed: <b>{counts.unreviewed ?? "-"}</b>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search address / candidate..."
          style={{ padding: 10, border: "1px solid #ddd", borderRadius: 10, minWidth: 320 }}
        />

        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value as any)}
          style={{ padding: 10, borderRadius: 10 }}
        >
          <option value="all">All classes</option>
          <option value="storefront">Storefront</option>
          <option value="suite_center">Suite center</option>
          <option value="maildrop">Maildrop</option>
          <option value="residential">Residential</option>
          <option value="unknown">Unknown</option>
        </select>

        <button onClick={load} disabled={loading} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}>
          Refresh
        </button>
        <button
          onClick={runSweep}
          disabled={running}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", fontWeight: 700 }}
        >
          Run Sweep
        </button>
        <button
          onClick={runTopDensitySweep}
          disabled={running}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", fontWeight: 700 }}
        >
          Sweep Top Density (25)
        </button>
        <button
          disabled={running}
          onClick={async () => {
            try {
              const j = await postBulk("reject_out_of_scope");
              await load();
              alert(`Rejected out-of-scope: ${j.changedCount ?? 0}`);
            } catch (e: any) {
              alert(e?.message || "Bulk action failed");
            }
          }}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
        >
          Reject OUT OF SCOPE
        </button>
        <button
          disabled={running}
          onClick={async () => {
            try {
              const j = await postBulk("reject_maildrop");
              await load();
              alert(`Rejected maildrops: ${j.changedCount ?? 0}`);
            } catch (e: any) {
              alert(e?.message || "Bulk action failed");
            }
          }}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
        >
          Reject MAILDROPS
        </button>
        <button
          disabled={running}
          onClick={async () => {
            try {
              const name = window.prompt(
                "Target list name?",
                `suite-centers-${new Date().toISOString().slice(0, 10)}`
              );
              const j = await postBulk("create_suite_center_target_list", { name: name || "" });
              alert(`Created list ${j?.list?.id || "(unknown)"} with ${j?.itemsAdded ?? 0} items`);
            } catch (e: any) {
              alert(e?.message || "Bulk action failed");
            }
          }}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", fontWeight: 700 }}
        >
          Create Target List: Suite Centers
        </button>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {filtered.map((r) => {
          const ak = String(r?.addressKey || "");
          const candidates: any[] = Array.isArray(r?.sweepCandidates) ? r.sweepCandidates : [];
          const selectedPlaceId = selectedByAk[ak] || "";
          const selectedCandidate =
            candidates.find((c) => String(c?.placeId || "") === selectedPlaceId) ||
            candidates.find((c) => !selectedPlaceId) ||
            null;
          const reasonsList: string[] = Array.isArray(r?.reasons) ? r.reasons : [];
          const noHits = reasonsList.includes("no_external_hits");
          const needsSweep = reasonsList.includes("needs_external_sweep");
          const outOfScope = reasonsList.includes("out_of_scope_state");
          const klass = String(r?.effectiveAddressClass || r?.addressClass || "unknown");
          const conf = Number(r?.confidence ?? 0).toFixed(2);

          return (
            <div key={ak} style={{ border: "1px solid #e7e7e7", borderRadius: 14, padding: 14 }}>
              <div style={{ fontWeight: 800 }}>{r?.effectiveTopCandidate?.name || r?.topCandidate?.name || "(no top candidate)"}</div>
              <div style={{ opacity: 0.75, marginTop: 4 }}>{ak}</div>
              <div style={{ marginTop: 8, fontSize: 13 }}>
                class: <b>{klass}</b> · confidence: <b>{conf}</b> · source: <b>{r?.source?.mode || "unknown"}</b>
              </div>
              {outOfScope ? (
                <div style={{ marginTop: 6 }}>
                  <span style={{ padding: "2px 8px", borderRadius: 999, border: "1px solid #ddd", fontSize: 12 }}>
                    OUT OF SCOPE
                  </span>
                </div>
              ) : null}
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                reasons: {(r?.reasons || []).join(", ") || "(none)"}
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Candidates</div>
                {candidates.length ? (
                  <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                    {candidates.slice(0, 8).map((c, i) => {
                      const id = `${ak}__${i}`;
                      const v = String(c?.placeId || "");
                      return (
                        <label key={id} style={{ display: "block", fontSize: 13, cursor: "pointer" }}>
                          <input
                            type="radio"
                            name={`cand_${ak}`}
                            checked={selectedPlaceId ? selectedPlaceId === v : i === 0}
                            onChange={() => setSelectedByAk((prev) => ({ ...prev, [ak]: v }))}
                          />{" "}
                          <b>{c?.name || "(unnamed)"}</b> · score {c?.score ?? 0} · {(c?.types || []).slice(0, 3).join(", ") || "no-types"}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, opacity: 0.75, marginTop: 6 }}>
                    {needsSweep
                      ? "Needs sweep (stub mode or geocode failed)."
                      : noHits
                        ? "Swept: no nearby beauty businesses found."
                        : "No candidates."}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  disabled={busyAk === ak || !selectedCandidate}
                  onClick={() => decide(ak, "confirm_candidate", selectedCandidate)}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", fontWeight: 700 }}
                >
                  Confirm Candidate
                </button>
                <button
                  disabled={busyAk === ak}
                  onClick={() => decide(ak, "suite_center")}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                >
                  Mark Suite Center
                </button>
                <button
                  disabled={busyAk === ak}
                  onClick={() => decide(ak, "residential")}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                >
                  Mark Residential
                </button>
                <button
                  disabled={busyAk === ak}
                  onClick={() => decide(ak, "unknown")}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                >
                  Mark Unknown
                </button>
                <button
                  disabled={busyAk === ak}
                  onClick={() => decide(ak, "no_storefront")}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                >
                  No Storefront
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
