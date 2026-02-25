"use client";

import React, { useEffect, useMemo, useState } from "react";

type Row = {
  addressKey: string;
  rollupKey: string | null;
  businessName: string;
  status: "Active" | "Expired" | "Unknown";
  licenseNumber: string;
  techCountAtAddress: number;
  sampleTechIds: string[];
  bucket: "solo" | "indie" | "suite-signal";
  franchiseBrandId: string | null;
  placeType: "salon" | "suite" | "home" | null;
  placeName?: string | null;
  placeConfidence?: number | null;

  // merged activity/org signals
  activeLicenseesAtAddress?: number;
  expiredLicenseesAtAddress?: number;
  unknownStatusAtAddress?: number;
  activeShare?: number;
  isPOBox?: boolean;
  isOfficeTowerish?: boolean;
  isLikelyMaildrop?: boolean;
  needsConfirm?: boolean;

  // locked structural fields
  hasReg?: boolean;
  category?: "independent-tech" | "indie-salon" | "suite-cluster" | "maildrop";
};

type ApiResp = {
  ok: boolean;
  updatedAt: string | null;
  counts: any;
  rows: Row[];
};

function cmp(a: any, b: any) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

function mapsUrlFromAddressKey(addressKey: string) {
  // addressKey is "ADDR | CITY | ST | ZIP"
  const q = addressKey.replace(/\s*\|\s*/g, " ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function bestName(r: any) {
  const pn = String(r.placeName ?? "").trim();
  if (pn) return pn;

  const bn = String(r.businessName ?? "").trim();
  if (bn && bn.toLowerCase() !== "unknown") return bn;

  return "Unknown";
}

function safeActiveShare(r: any) {
  const n = Number(r.activeShare ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

function tierLabel(r: any) {
  const a = safeActiveShare(r);
  if (a >= 0.7) return "A";
  if (a >= 0.4) return "B";
  return "C";
}

function badge(text: string, tone: "muted" | "good" | "warn" | "bad" = "muted") {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid rgba(0,0,0,0.15)",
    marginRight: 6,
    whiteSpace: "nowrap",
  };

  const tones: Record<string, React.CSSProperties> = {
    muted: { background: "rgba(0,0,0,0.03)" },
    good: { background: "rgba(0,128,0,0.08)" },
    warn: { background: "rgba(255,165,0,0.10)" },
    bad: { background: "rgba(255,0,0,0.08)" },
  };

  return <span style={{ ...base, ...(tones[tone] ?? tones.muted) }}>{text}</span>;
}

function exportCsv(filename: string, rows: Record<string, any>[]) {
  const keys = Array.from(
    new Set(rows.flatMap((r) => Object.keys(r)))
  );

  const esc = (v: any) => {
    const s = String(v ?? "");
    // CSV escape: quote and double quotes
    const q = `"${s.replace(/"/g, '""')}"`;
    return q;
  };

  const lines = [
    keys.join(","),
    ...rows.map((r) => keys.map((k) => esc(r[k])).join(",")),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 250);
}

export default function FacilitiesClient() {
  const [data, setData] = useState<ApiResp | null>(null);

  // UI state
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Row["category"] | "all">("indie-salon");
  const [minActiveShare, setMinActiveShare] = useState<number>(0);
  const [hasRegOnly, setHasRegOnly] = useState(false);
  const [needsConfirmOnly, setNeedsConfirmOnly] = useState(false);
  const [showConfirmQueue, setShowConfirmQueue] = useState(false);

  const [sortKey, setSortKey] = useState<keyof Row>("techCountAtAddress");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string>("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/dora/truth/facilities/index", { cache: "no-store" });
      const json = (await res.json()) as ApiResp;
      setData(json);
    })();
  }, []);

  useEffect(() => {
    // default sort by tab
    if (tab === "indie-salon") {
      setSortKey("activeShare");
      setSortDir("desc");
    } else if (tab === "independent-tech") {
      setSortKey("activeShare");
      setSortDir("desc");
    } else if (tab === "suite-cluster") {
      setSortKey("techCountAtAddress");
      setSortDir("desc");
    } else if (tab === "maildrop") {
      setSortKey("techCountAtAddress");
      setSortDir("desc");
    } else {
      setSortKey("techCountAtAddress");
      setSortDir("desc");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const rows = data?.rows ?? [];
  const queueCount = rows.filter((r) => r.needsConfirm === true).length;

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return rows
      .filter((r) => (tab === "all" ? true : r.category === tab))
      .filter((r) =>
        showConfirmQueue
          ? r.needsConfirm === true && (r.category === "suite-cluster" || r.category === "maildrop")
          : true
      )
      .filter((r) => {
        const as = Number(r.activeShare ?? 0);
        return as >= minActiveShare;
      })
      .filter((r) => (hasRegOnly ? r.hasReg === true : true))
      .filter((r) => (needsConfirmOnly ? r.needsConfirm === true : true))
      .filter((r) => {
        if (!qq) return true;
        return (
          (r.businessName ?? "").toLowerCase().includes(qq) ||
          (r.addressKey ?? "").toLowerCase().includes(qq) ||
          (r.rollupKey ?? "").toLowerCase().includes(qq) ||
          (r.licenseNumber ?? "").toLowerCase().includes(qq)
        );
      })
      .slice()
      .sort((a, b) => {
        const d = cmp(a[sortKey], b[sortKey]);
        return sortDir === "asc" ? d : -d;
      });
  }, [rows, q, tab, showConfirmQueue, minActiveShare, hasRegOnly, needsConfirmOnly, sortKey, sortDir]);

  function toggleSort(k: keyof Row) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir(k === "techCountAtAddress" ? "desc" : "asc");
    }
  }

  function applyPreset(kind: "owner" | "suite" | "independent") {
    if (kind === "owner") {
      setTab("indie-salon");
      setMinActiveShare(0.6);
      setHasRegOnly(true);
      setSortKey("techCountAtAddress");
      setSortDir("desc");
      return;
    }
    if (kind === "suite") {
      setTab("suite-cluster");
      setMinActiveShare(0.5);
      setHasRegOnly(false);
      setSortKey("techCountAtAddress");
      setSortDir("desc");
      return;
    }
    setTab("independent-tech");
    setMinActiveShare(0.5);
    setHasRegOnly(false);
    setSortKey("techCountAtAddress");
    setSortDir("desc");
  }

  function toggleRow(addressKey: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(addressKey)) next.delete(addressKey);
      else next.add(addressKey);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function selectFilteredTop(n: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of filtered.slice(0, n)) next.add(r.addressKey);
      return next;
    });
  }

  function selectAllFiltered(max = 500) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of filtered.slice(0, max)) next.add(r.addressKey);
      return next;
    });
  }

  function exportSelectedCsv() {
    const keys = new Set(selected);
    const pick = filtered.filter((r) => keys.has(r.addressKey));

    const out = pick.map((r) => ({
      addressKey: r.addressKey,
      bestName: bestName(r),
      category: r.category ?? "",
      placeType: r.placeType ?? "",
      franchiseBrandId: r.franchiseBrandId ?? "",
      techCountAtAddress: r.techCountAtAddress ?? 0,
      activeShare: safeActiveShare(r).toFixed(4),
      hasReg: r.hasReg ? "1" : "0",
      mapsUrl: (r as any).mapsUrl ?? mapsUrlFromAddressKey(r.addressKey),
    }));

    exportCsv(`vmb_selected_${new Date().toISOString().slice(0, 10)}.csv`, out);
  }

  async function saveTargetList() {
    setSaveMsg("");
    const addressKeys = Array.from(selected.values());
    if (!addressKeys.length) {
      setSaveMsg("Select at least 1 row first.");
      return;
    }

    const name = window.prompt("Target list name?", `${tab}-targets-${new Date().toISOString().slice(0, 10)}`);
    if (!name) return;

    setSaving(true);
    try {
      const payload = {
        name,
        addressKeys,
        meta: {
          tab,
          q,
          minActiveShare,
          hasRegOnly,
          needsConfirmOnly,
          sortKey,
          sortDir,
          selectedCount: addressKeys.length,
        },
      };

      const res = await fetch("/api/admin/targets/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setSaveMsg(`Save failed: ${json?.error ?? res.statusText}`);
        return;
      }

      setSaveMsg(`Saved "${name}" (${addressKeys.length} addresses).`);
      clearSelection();
    } catch (e: any) {
      setSaveMsg(`Save failed: ${e?.message ?? String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = selected.size;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>DORA Facilities — Targeting</h1>
        <div style={{ opacity: 0.7 }}>
          Updated: {data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "-"}
        </div>
      </div>
      <div style={{ marginTop: 6 }}>
        <a href="/admin/dora/confirm">Go to Confirm Queue ({queueCount})</a>
      </div>

      {/* Tabs */}
      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {([
          ["indie-salon", "Indie Salons"],
          ["independent-tech", "Independent Tech"],
          ["suite-cluster", "Suite Clusters"],
          ["maildrop", "Maildrops"],
          ["all", "All"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k as any)}
            style={{
              padding: "8px 10px",
              border: "1px solid rgba(0,0,0,0.2)",
              borderRadius: 8,
              background: tab === k ? "rgba(0,0,0,0.06)" : "transparent",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={() => applyPreset("owner")}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)", cursor: "pointer" }}
        >
          Preset A: Owner targets
        </button>
        <button
          onClick={() => applyPreset("suite")}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)", cursor: "pointer" }}
        >
          Preset B: Suite hunting
        </button>
        <button
          onClick={() => applyPreset("independent")}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)", cursor: "pointer" }}
        >
          Preset C: Big independent pool
        </button>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name / address / rollup / license..."
          style={{ padding: 10, minWidth: 360 }}
        />

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ opacity: 0.7 }}>Min activeShare</span>
          <input
            type="number"
            step="0.05"
            min={0}
            max={1}
            value={minActiveShare}
            onChange={(e) => setMinActiveShare(Math.max(0, Math.min(1, Number(e.target.value || 0))))}
            style={{ padding: 10, width: 110 }}
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={hasRegOnly} onChange={(e) => setHasRegOnly(e.target.checked)} />
          <span>hasReg only</span>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={needsConfirmOnly} onChange={(e) => setNeedsConfirmOnly(e.target.checked)} />
          <span>needsConfirm only</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={showConfirmQueue} onChange={(e) => setShowConfirmQueue(e.target.checked)} />
          <span>Confirm Queue</span>
        </label>

        <div style={{ opacity: 0.8 }}>
          Showing <b>{filtered.length}</b> / {rows.length}
        </div>
      </div>

      {/* Selection actions */}
      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          Selected: <b>{selectedCount}</b>
        </div>

        <button
          onClick={() => selectFilteredTop(50)}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)", cursor: "pointer" }}
        >
          Select top 50 (filtered)
        </button>
        <button
          onClick={() => selectAllFiltered(500)}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)", cursor: "pointer" }}
        >
          Select all filtered (≤ 500)
        </button>

        <button
          onClick={clearSelection}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)", cursor: "pointer" }}
        >
          Clear selection
        </button>

        <button
          onClick={saveTargetList}
          disabled={saving}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.2)",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving..." : "Save target list"}
        </button>

        {saveMsg ? <div style={{ opacity: 0.8 }}>{saveMsg}</div> : null}
      </div>

      {/* Table */}
      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>Pick</th>

              {[
                ["techCountAtAddress", "Techs"],
                ["activeShare", "ActiveShare"],
                ["category", "Type"],
                ["businessName", "Name / Address"],
              ].map(([k, label]) => (
                <th
                  key={k}
                  onClick={() => toggleSort(k as keyof Row)}
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    padding: "10px 8px",
                    borderBottom: "1px solid rgba(0,0,0,0.15)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label} {sortKey === k ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </th>
              ))}

              <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>
                Maps
              </th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((r) => {
              const picked = selected.has(r.addressKey);

              return (
                <tr key={r.addressKey}>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                    <input type="checkbox" checked={picked} onChange={() => toggleRow(r.addressKey)} />
                  </td>

                  <td style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                    <b>{r.techCountAtAddress}</b>
                  </td>

                  <td style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                    {badge(`Tier ${tierLabel(r)}`, tierLabel(r) === "A" ? "good" : tierLabel(r) === "B" ? "warn" : "muted")}
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{safeActiveShare(r).toFixed(2)}</span>
                  </td>

                  <td style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                    {badge(r.category ?? "—", r.category === "suite-cluster" ? "warn" : r.category === "maildrop" ? "bad" : "muted")}
                    {r.hasReg ? badge("REG", "good") : badge("no-reg", "muted")}
                    {r.placeType ? badge(`place:${r.placeType}`, "muted") : null}
                    {r.franchiseBrandId ? badge(`brand:${r.franchiseBrandId}`, "muted") : null}
                  </td>

                  <td style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                    <div style={{ fontWeight: 700 }}>{bestName(r)}</div>
                    <div style={{ opacity: 0.75, marginTop: 4 }}>
                      <code style={{ fontSize: 12 }}>{r.addressKey}</code>
                    </div>
                  </td>

                  <td style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                    <a href={mapsUrlFromAddressKey(r.addressKey)} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </td>
                </tr>
              );
            })}

            {!filtered.length ? (
              <tr>
                <td colSpan={6} style={{ padding: 16, opacity: 0.7 }}>
                  No rows match filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {selectedCount > 0 ? (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            marginTop: 14,
            padding: 12,
            borderTop: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            display: "flex",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div>
            Selected: <b>{selectedCount}</b>
            <span style={{ opacity: 0.7 }}> (filtered subset)</span>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={exportSelectedCsv}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)", cursor: "pointer" }}
            >
              Export selected CSV
            </button>

            <button
              onClick={saveTargetList}
              disabled={saving}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.2)",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving…" : "Save target list"}
            </button>

            <button
              onClick={clearSelection}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)", cursor: "pointer" }}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
