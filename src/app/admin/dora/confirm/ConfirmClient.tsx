"use client";

import React, { useEffect, useMemo, useState } from "react";

type FacilityRow = {
  addressKey: string;
  techCountAtAddress: number;
  category?: string;
  businessName?: string;
  hasReg?: boolean;
  activeShare?: number;
  needsConfirm?: boolean;

  // override-applied fields (from facilities after merge:facilities:place)
  placeType?: string | null;
  placeName?: string | null;
  placeConfidence?: number;
  franchiseBrandId?: string | null;
  website?: string | null;
  phone?: string | null;
  ig?: string | null;
  mapsUrl?: string | null;
  placeNotes?: string | null;

  isLikelyMaildrop?: boolean;
};

type FacilitiesApi = {
  ok: boolean;
  updatedAt: string | null;
  rows: FacilityRow[];
};

type OverrideRow = {
  addressKey: string;
  placeType?: "suite" | "salon" | "home" | "maildrop" | "unknown";
  placeName?: string | null;
  franchiseBrandId?: string | null;
  confidence?: number;
  notes?: string;
  mapsUrl?: string | null;
  website?: string | null;
  phone?: string | null;
  ig?: string | null;
};

type OverridesApi = {
  ok: boolean;
  updatedAt: string | null;
  rows: OverrideRow[];
};

function mapsUrlFromAddressKey(addressKey: string) {
  const q = addressKey.replace(/\s*\|\s*/g, " ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export default function ConfirmClient() {
  const [fac, setFac] = useState<FacilitiesApi | null>(null);
  const [ovr, setOvr] = useState<OverridesApi | null>(null);

  const [msg, setMsg] = useState<string>("");
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function loadAll(clearMessage = true) {
    if (clearMessage) setMsg("");
    const [a, b] = await Promise.all([
      fetch("/api/admin/dora/truth/facilities/index", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/dora/confirm/place-overrides", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setFac(a);
    setOvr(b);
    return { facilities: a as FacilitiesApi, overrides: b as OverridesApi };
  }

  useEffect(() => {
    loadAll();
  }, []);

  const overridesByKey = useMemo(() => {
    const m = new Map<string, OverrideRow>();
    for (const r of ovr?.rows ?? []) m.set(r.addressKey, r);
    return m;
  }, [ovr]);

  const queue = useMemo(() => {
    const rows = fac?.rows ?? [];
    return rows
      .filter((r) => r.needsConfirm === true)
      .slice()
      .sort((a, b) => (b.techCountAtAddress ?? 0) - (a.techCountAtAddress ?? 0));
  }, [fac]);

  async function saveRow(addressKey: string, draft: OverrideRow) {
    setMsg("");
    setSavingKey(addressKey);
    try {
      const res = await fetch("/api/admin/dora/confirm/place-overrides", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setMsg(`Save failed: ${json?.error ?? res.statusText}`);
        return;
      }
      const applyRes = await fetch("/api/admin/dora/confirm/apply-place-merge", { method: "POST" });
      const applyJson = await applyRes.json().catch(() => ({}));
      if (!applyRes.ok || !applyJson?.ok) {
        setMsg(`Saved override, but apply failed: ${applyJson?.stderr || applyRes.statusText}`);
        return;
      }
      const loaded = await loadAll(false);
      const remaining = (loaded?.facilities?.rows ?? []).filter((r) => r.needsConfirm === true).length;
      setMsg(`Saved + applied. Queue now: ${remaining}.`);
    } catch (e: any) {
      setMsg(`Save failed: ${e?.message ?? String(e)}`);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Confirm Queue</h1>
        <div style={{ opacity: 0.7 }}>
          Queue: <b>{queue.length}</b> • Facilities updated:{" "}
          {fac?.updatedAt ? new Date(fac.updatedAt).toLocaleString() : "—"}
        </div>
        <button
          onClick={loadAll}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.2)", cursor: "pointer" }}
        >
          Refresh
        </button>
      </div>

      <div style={{ marginTop: 8, opacity: 0.8 }}>
        Save override applies merge immediately.
      </div>

      {msg ? <div style={{ marginTop: 10, opacity: 0.9 }}>{msg}</div> : null}

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        {queue.map((r) => {
          const existing = overridesByKey.get(r.addressKey);

          // start from existing override if present, otherwise seed from facility
          const seed: OverrideRow = {
            addressKey: r.addressKey,
            placeType: (existing?.placeType ?? "unknown") as any,
            placeName: existing?.placeName ?? r.placeName ?? null,
            franchiseBrandId: existing?.franchiseBrandId ?? r.franchiseBrandId ?? null,
            confidence: existing?.confidence ?? (typeof r.placeConfidence === "number" ? r.placeConfidence : 0),
            notes: existing?.notes ?? r.placeNotes ?? "",
            mapsUrl: existing?.mapsUrl ?? r.mapsUrl ?? mapsUrlFromAddressKey(r.addressKey),
            website: existing?.website ?? r.website ?? null,
            phone: existing?.phone ?? r.phone ?? null,
            ig: existing?.ig ?? r.ig ?? null,
          };

          return <ConfirmCard key={r.addressKey} row={r} seed={seed} onSave={saveRow} savingKey={savingKey} />;
        })}

        {!queue.length ? (
          <div style={{ padding: 16, opacity: 0.75 }}>
            No rows in confirm queue. You're clean. ✅
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ConfirmCard({
  row,
  seed,
  onSave,
  savingKey,
}: {
  row: FacilityRow;
  seed: OverrideRow;
  onSave: (addressKey: string, draft: OverrideRow) => Promise<void>;
  savingKey: string | null;
}) {
  const [draft, setDraft] = useState<OverrideRow>(seed);

  useEffect(() => {
    setDraft(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed.addressKey]);

  const disabled = savingKey === row.addressKey;

  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.15)",
        borderRadius: 12,
        padding: 12,
        background: "rgba(0,0,0,0.02)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 800 }}>
            {row.category ?? "—"} • <span style={{ opacity: 0.75 }}>{row.techCountAtAddress} techs</span>
          </div>
          <div style={{ marginTop: 6 }}>
            <code style={{ fontSize: 12 }}>{row.addressKey}</code>
          </div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>
            ActiveShare: <b>{Number(row.activeShare ?? 0).toFixed(2)}</b>{" "}
            {row.hasReg ? "• REG ✅" : "• REG —"} {row.isLikelyMaildrop ? "• maildrop-flag ✅" : ""}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a href={draft.mapsUrl ?? mapsUrlFromAddressKey(row.addressKey)} target="_blank" rel="noreferrer">
            Open Maps
          </a>
          <button
            disabled={disabled}
            onClick={() => onSave(row.addressKey, draft)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.2)",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.6 : 1,
            }}
          >
            {disabled ? "Saving…" : "Save override"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "180px 1fr", gap: 10, alignItems: "center" }}>
        <label style={{ opacity: 0.8 }}>placeType</label>
        <select
          value={draft.placeType ?? "unknown"}
          onChange={(e) => setDraft((p) => ({ ...p, placeType: e.target.value as any }))}
          style={{ padding: 10 }}
        >
          <option value="unknown">unknown</option>
          <option value="suite">suite</option>
          <option value="salon">salon</option>
          <option value="home">home</option>
          <option value="maildrop">maildrop</option>
        </select>

        <label style={{ opacity: 0.8 }}>placeName</label>
        <input
          value={draft.placeName ?? ""}
          onChange={(e) => setDraft((p) => ({ ...p, placeName: e.target.value }))}
          placeholder="Google place name…"
          style={{ padding: 10 }}
        />

        <label style={{ opacity: 0.8 }}>franchiseBrandId</label>
        <input
          value={draft.franchiseBrandId ?? ""}
          onChange={(e) => setDraft((p) => ({ ...p, franchiseBrandId: e.target.value }))}
          placeholder="sola | phenix | salonsbyjc | …"
          style={{ padding: 10 }}
        />

        <label style={{ opacity: 0.8 }}>confidence (0-100)</label>
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={Number(draft.confidence ?? 0)}
          onChange={(e) => setDraft((p) => ({ ...p, confidence: Number(e.target.value || 0) }))}
          style={{ padding: 10, width: 160 }}
        />

        <label style={{ opacity: 0.8 }}>website</label>
        <input
          value={draft.website ?? ""}
          onChange={(e) => setDraft((p) => ({ ...p, website: e.target.value }))}
          placeholder="https://…"
          style={{ padding: 10 }}
        />

        <label style={{ opacity: 0.8 }}>phone</label>
        <input
          value={draft.phone ?? ""}
          onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))}
          placeholder="(###) ###-####"
          style={{ padding: 10 }}
        />

        <label style={{ opacity: 0.8 }}>ig</label>
        <input
          value={draft.ig ?? ""}
          onChange={(e) => setDraft((p) => ({ ...p, ig: e.target.value }))}
          placeholder="@handle"
          style={{ padding: 10 }}
        />

        <label style={{ opacity: 0.8 }}>notes</label>
        <textarea
          value={draft.notes ?? ""}
          onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
          placeholder="How you confirmed it…"
          style={{ padding: 10, minHeight: 70 }}
        />
      </div>
    </div>
  );
}
