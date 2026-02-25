"use client";

import React, { useMemo, useState } from "react";

type PreviewResp = {
  ok: boolean;
  format: string;
  suggestedSeedFile?: string;
  counts?: { input: number; matched: number; notFound: number; invalid: number };
  matched?: any[];
  notFound?: any[];
  invalid?: any[];
  error?: string;
};

export default function FacilitiesImportPage() {
  const [format, setFormat] = useState<"jsonl" | "csv">("jsonl");
  const [brand, setBrand] = useState("Great Clips");
  const [category, setCategory] = useState("SALON_CORP_CHAIN");
  const [source, setSource] = useState("operator_import");
  const [seedFileName, setSeedFileName] = useState("");
  const [operatorNote, setOperatorNote] = useState("");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<PreviewResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [commitResp, setCommitResp] = useState<any>(null);

  const defaults = useMemo(() => ({ brand, category, source }), [brand, category, source]);

  async function runPreview() {
    setBusy(true);
    setCommitResp(null);
    try {
      const res = await fetch("/api/admin/facilities/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, text, defaults, seedFileName }),
      });
      const j = await res.json();
      setPreview(j);
      if (!seedFileName && j?.suggestedSeedFile) setSeedFileName(j.suggestedSeedFile);
    } finally {
      setBusy(false);
    }
  }

  async function runCommit() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/facilities/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, text, defaults, seedFileName, operatorNote }),
      });
      const j = await res.json();
      setCommitResp(j);
      // refresh preview after commit so counts reflect new state
      await runPreview();
    } finally {
      setBusy(false);
    }
  }

  const counts = preview?.counts;

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>Facilities Import</h1>
      <div style={{ color: "#444", marginBottom: 16 }}>
        Paste JSONL or CSV {"->"} Preview MATCHED vs NOT FOUND {"->"} Commit appends seeds + rebuilds
        facility index.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* LEFT: INPUT */}
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Format</div>
              <select value={format} onChange={(e) => setFormat(e.target.value as any)} style={{ padding: 8 }}>
                <option value="jsonl">JSONL</option>
                <option value="csv">CSV</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 4, minWidth: 220 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Default Brand</div>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} style={{ padding: 8 }} />
            </label>

            <label style={{ display: "grid", gap: 4, minWidth: 220 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Default Category</div>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: 8 }}>
                <option value="SALON_CORP_CHAIN">SALON_CORP_CHAIN</option>
                <option value="SEAT_AGGREGATOR">SEAT_AGGREGATOR</option>
                <option value="FACILITY">FACILITY</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 4, minWidth: 220 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Default Source</div>
              <input value={source} onChange={(e) => setSource(e.target.value)} style={{ padding: 8 }} />
            </label>
          </div>

          <div style={{ display: "grid", gap: 10, marginBottom: 10 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Seed File Name (in facilities/seeds/)</div>
              <input
                value={seedFileName}
                onChange={(e) => setSeedFileName(e.target.value)}
                placeholder="e.g. great-clips.locations.v1.jsonl"
                style={{ padding: 8 }}
              />
            </label>

            <label style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Operator Note (receipt)</div>
              <input value={operatorNote} onChange={(e) => setOperatorNote(e.target.value)} style={{ padding: 8 }} />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Paste Input</div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  format === "jsonl"
                    ? '{"brand":"Great Clips","locationLabel":"Castle Pines","address1":"7280 Lagae Rd","address2":"Ste D","city":"Castle Rock","state":"CO","zip":"80108","category":"SALON_CORP_CHAIN","source":"greatclips_locator"}'
                    : "brand,locationLabel,address1,address2,city,state,zip,category,source\nGreat Clips,Castle Pines,7280 Lagae Rd,Ste D,Castle Rock,CO,80108,SALON_CORP_CHAIN,greatclips_locator"
                }
                style={{ padding: 10, minHeight: 320, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={runPreview}
              disabled={busy || !text.trim()}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #222",
                background: "#fff",
                fontWeight: 800,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              Preview
            </button>

            <button
              onClick={runCommit}
              disabled={busy || !text.trim()}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #222",
                background: "#222",
                color: "#fff",
                fontWeight: 900,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              Commit
            </button>

            <div style={{ alignSelf: "center", color: "#555" }}>{busy ? "Working..." : ""}</div>
          </div>
        </div>

        {/* RIGHT: RESULTS */}
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontWeight: 900 }}>Preview Results</div>
            <div style={{ fontFamily: "ui-monospace, Menlo, monospace", color: "#444" }}>
              {counts
                ? `in:${counts.input} matched:${counts.matched} notFound:${counts.notFound} invalid:${counts.invalid}`
                : "-"}
            </div>
          </div>

          {preview?.ok === false ? (
            <div style={{ color: "crimson" }}>Error: {preview?.error || "preview failed"}</div>
          ) : null}

          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>MATCHED</div>
            <div style={{ maxHeight: 180, overflow: "auto", border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
              {(preview?.matched || []).slice(0, 200).map((r: any, i: number) => (
                <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid #f3f3f3" }}>
                  <div style={{ fontWeight: 800 }}>
                    {r?.matched?.displayName || r?.input?.brand || "Facility"}
                  </div>
                  <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: "#444" }}>
                    {r?.addressKey}
                  </div>
                </div>
              ))}
              {!preview?.matched?.length ? <div style={{ color: "#666" }}>-</div> : null}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>NOT FOUND (will be seeded)</div>
            <div style={{ maxHeight: 240, overflow: "auto", border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
              {(preview?.notFound || []).slice(0, 400).map((r: any, i: number) => (
                <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid #f3f3f3" }}>
                  <div style={{ fontWeight: 800 }}>
                    {(r?.input?.brand || brand) +
                      (r?.input?.locationLabel ? ` - ${r.input.locationLabel}` : "")}
                  </div>
                  <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: "#444" }}>
                    {r?.addressKey}
                  </div>
                </div>
              ))}
              {!preview?.notFound?.length ? <div style={{ color: "#666" }}>-</div> : null}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>INVALID</div>
            <div style={{ maxHeight: 140, overflow: "auto", border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
              {(preview?.invalid || []).slice(0, 200).map((r: any, i: number) => (
                <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid #f3f3f3" }}>
                  <div style={{ color: "crimson", fontWeight: 800 }}>{r?.reason || "invalid row"}</div>
                  <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: "#444" }}>
                    {JSON.stringify(r?.input || {})}
                  </div>
                </div>
              ))}
              {!preview?.invalid?.length ? <div style={{ color: "#666" }}>-</div> : null}
            </div>
          </div>

          {commitResp ? (
            <div style={{ marginTop: 14, padding: 10, borderRadius: 10, border: "1px solid #ddd" }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Last Commit</div>
              {commitResp.ok ? (
                <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}>
                  <div>seedFile: {commitResp.seedFilePath}</div>
                  <div>receipt: {commitResp.receiptPath}</div>
                  <div>facilityIndexUpdatedAt: {commitResp.facilityIndexUpdatedAt}</div>
                  <div>facilities: {commitResp.facilityIndexCount}</div>
                  <div>techIndexFacilitiesPath: {commitResp.techIndexFacilitiesPath}</div>
                  <div>techIndexFacilitiesAttached: {commitResp.techIndexFacilitiesAttached}</div>
                  <div>techIndexFacilitiesUpdatedAt: {commitResp.techIndexFacilitiesUpdatedAt}</div>
                  {commitResp.techIndexFacilitiesError ? (
                    <div style={{ color: "crimson" }}>
                      techIndexFacilitiesError: {commitResp.techIndexFacilitiesError}
                    </div>
                  ) : null}
                  <div>placesMatchedFacilitiesPath: {commitResp.placesMatchedFacilitiesPath}</div>
                  <div>placesMatchedFacilitiesAttached: {commitResp.placesMatchedFacilitiesAttached}</div>
                  <div>
                    placesMatchedExact/Norm/Base: {commitResp.placesMatchedFacilitiesExact}/
                    {commitResp.placesMatchedFacilitiesNorm}/{commitResp.placesMatchedFacilitiesBase}
                  </div>
                  <div>placesMatchedFacilitiesUpdatedAt: {commitResp.placesMatchedFacilitiesUpdatedAt}</div>
                  {commitResp.placesMatchedFacilitiesError ? (
                    <div style={{ color: "crimson" }}>
                      placesMatchedFacilitiesError: {commitResp.placesMatchedFacilitiesError}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div style={{ color: "crimson" }}>Commit failed: {commitResp.error}</div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
