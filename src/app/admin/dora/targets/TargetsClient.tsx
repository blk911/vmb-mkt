"use client";

import React, { useEffect, useMemo, useState } from "react";

type TargetList = {
  id: string;
  name: string;
  createdAt: string;
  addressKeys: string[];
  meta?: Record<string, any>;
};

type TargetsResp = {
  ok: boolean;
  updatedAt: string | null;
  lists: TargetList[];
};

type FacilityRow = {
  addressKey: string;
  businessName?: string;
  placeName?: string | null;
  category?: string;
  activeShare?: number;
  mapsUrl?: string | null;
  techCountAtAddress?: number;
  hasReg?: boolean;
  placeType?: string | null;
  franchiseBrandId?: string | null;
};

type FacilitiesResp = {
  ok: boolean;
  updatedAt: string | null;
  rows: FacilityRow[];
};

function mapsUrlFromAddressKey(addressKey: string) {
  const q = addressKey.replace(/\s*\|\s*/g, " ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function csvCell(v: any) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function TargetsClient() {
  const [targets, setTargets] = useState<TargetsResp | null>(null);
  const [facilities, setFacilities] = useState<FacilitiesResp | null>(null);
  const [selectedListId, setSelectedListId] = useState<string>("");

  async function load() {
    const [t, f] = await Promise.all([
      fetch("/api/admin/targets/save", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/dora/truth/facilities/index", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setTargets(t);
    setFacilities(f);
    if (!selectedListId && Array.isArray(t?.lists) && t.lists[0]?.id) {
      setSelectedListId(t.lists[0].id);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const byAddress = useMemo(() => {
    const m = new Map<string, FacilityRow>();
    for (const r of facilities?.rows ?? []) m.set(r.addressKey, r);
    return m;
  }, [facilities]);

  const selected = useMemo(
    () => (targets?.lists ?? []).find((l) => l.id === selectedListId) ?? null,
    [targets, selectedListId]
  );

  const rows = useMemo(() => {
    if (!selected) return [];
    return selected.addressKeys.map((addressKey) => {
      const f = byAddress.get(addressKey);
      const bestAddressLabel = f?.placeName || (f?.businessName && f.businessName !== "Unknown" ? f.businessName : "");
      return {
        addressKey,
        bestAddressLabel,
        category: f?.category || "",
        activeShare: typeof f?.activeShare === "number" ? f.activeShare : "",
        mapsUrl: f?.mapsUrl || mapsUrlFromAddressKey(addressKey),
        techCountAtAddress: typeof f?.techCountAtAddress === "number" ? f.techCountAtAddress : "",
        hasReg: f?.hasReg === true ? "true" : "false",
        placeType: f?.placeType || "",
        franchiseBrandId: f?.franchiseBrandId || "",
      };
    });
  }, [selected, byAddress]);

  function exportCsv() {
    if (!selected) return;
    const header = [
      "addressKey",
      "bestAddressLabel",
      "category",
      "activeShare",
      "mapsUrl",
      "techCountAtAddress",
      "hasReg",
      "placeType",
      "franchiseBrandId",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push([
        csvCell(r.addressKey),
        csvCell(r.bestAddressLabel),
        csvCell(r.category),
        csvCell(r.activeShare),
        csvCell(r.mapsUrl),
        csvCell(r.techCountAtAddress),
        csvCell(r.hasReg),
        csvCell(r.placeType),
        csvCell(r.franchiseBrandId),
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected.name.replace(/[^a-z0-9-_]+/gi, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>Saved Target Lists</h1>
      <div style={{ marginTop: 6, opacity: 0.75 }}>
        Store updated: {targets?.updatedAt ? new Date(targets.updatedAt).toLocaleString() : "—"}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={selectedListId}
          onChange={(e) => setSelectedListId(e.target.value)}
          style={{ padding: 10, minWidth: 320 }}
        >
          <option value="">Select target list…</option>
          {(targets?.lists ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.addressKeys.length})
            </option>
          ))}
        </select>
        <button
          onClick={exportCsv}
          disabled={!selected}
          style={{ padding: "8px 10px", border: "1px solid rgba(0,0,0,0.2)", borderRadius: 8 }}
        >
          Export CSV
        </button>
        <button
          onClick={load}
          style={{ padding: "8px 10px", border: "1px solid rgba(0,0,0,0.2)", borderRadius: 8 }}
        >
          Refresh
        </button>
      </div>

      {selected ? (
        <div style={{ marginTop: 10, opacity: 0.85 }}>
          <b>{selected.name}</b> • {selected.addressKeys.length} addresses • created{" "}
          {selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "—"}
        </div>
      ) : null}

      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>AddressKey</th>
              <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>Name</th>
              <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>Category</th>
              <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>ActiveShare</th>
              <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>Techs</th>
              <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>hasReg</th>
              <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>placeType</th>
              <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>franchiseBrandId</th>
              <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>Maps</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.addressKey}>
                <td style={{ padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                  <code style={{ fontSize: 12 }}>{r.addressKey}</code>
                </td>
                <td style={{ padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>{r.bestAddressLabel || "—"}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>{r.category || "—"}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                  {typeof r.activeShare === "number" ? Number(r.activeShare).toFixed(2) : "—"}
                </td>
                <td style={{ padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>{r.techCountAtAddress || "—"}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>{r.hasReg}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>{r.placeType || "—"}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>{r.franchiseBrandId || "—"}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                  <a href={r.mapsUrl} target="_blank" rel="noreferrer">Open</a>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={9} style={{ padding: 14, opacity: 0.7 }}>No rows for selected list.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
