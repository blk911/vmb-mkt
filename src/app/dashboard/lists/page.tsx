"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDashboardActions } from "../DashboardShell";

type TargetList = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  filters?: any;
  techIds: string[];
  notes?: string;
};

async function apiGetLists(): Promise<TargetList[]> {
  const res = await fetch("/api/targets/lists", { cache: "no-store" });
  const j = await res.json();
  return (j?.lists || []) as TargetList[];
}

async function apiPost(body: any): Promise<any> {
  const res = await fetch("/api/targets/lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return await res.json();
}

function fmtDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function safeJsonPreview(v: any, maxLen = 280) {
  try {
    const s = JSON.stringify(v ?? {}, null, 0);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + "…";
  } catch {
    return "";
  }
}

export default function ListsPage() {
  const { setActions, clearActions } = useDashboardActions();

  const [lists, setLists] = useState<TargetList[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeId, setActiveId] = useState<string>("");
  const active = useMemo(
    () => lists.find((l) => l.id === activeId) || null,
    [lists, activeId]
  );

  const [q, setQ] = useState("");
  const [newName, setNewName] = useState("");
  const [notesDraft, setNotesDraft] = useState("");

  async function refresh() {
    setLoading(true);
    const ls = await apiGetLists();
    setLists(ls);
    setLoading(false);
    if (!activeId && ls.length) setActiveId(ls[0].id);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep notesDraft in sync when active changes
  useEffect(() => {
    setNotesDraft(active?.notes || "");
    setNewName(active?.name || "");
  }, [active?.id]); // intentionally key by id

  // Header actions: export/print/open targets/delete (for active list)
  useEffect(() => {
    if (!active) {
      clearActions();
      return;
    }

    setActions([
      {
        id: "open_targets",
        label: "Open in Targets",
        onClick: () => {
          window.location.href = `/dashboard/targets?listId=${encodeURIComponent(active.id)}`;
        },
      },
      {
        id: "export_csv",
        label: "Export CSV",
        onClick: () => {
          window.location.href = `/api/targets/export?listId=${encodeURIComponent(active.id)}&format=csv`;
        },
      },
      {
        id: "print",
        label: "Print",
        onClick: () => {
          window.open(`/dashboard/targets/print?listId=${encodeURIComponent(active.id)}`, "_blank");
        },
      },
    ]);

    return () => clearActions();
  }, [active?.id, setActions, clearActions]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return lists;
    return lists.filter((l) => {
      const hay = `${l.name} ${l.id} ${(l.notes || "")}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [lists, q]);

  async function onRename() {
    if (!active) return;
    const name = newName.trim();
    if (!name || name === active.name) return;
    const out = await apiPost({ op: "rename", id: active.id, name });
    if (out?.ok) await refresh();
  }

  async function onSaveNotes() {
    if (!active) return;
    const out = await apiPost({ op: "setNotes", id: active.id, notes: notesDraft });
    if (out?.ok) await refresh();
  }

  async function onSaveFiltersSnapshot() {
    if (!active) return;
    // "Save current filters" is done in Targets when creating a list,
    // but here we allow re-storing the snapshot if you edit list strategy/notes.
    const out = await apiPost({ op: "setFilters", id: active.id, filters: active.filters ?? {} });
    if (out?.ok) await refresh();
  }

  async function onDelete() {
    if (!active) return;
    const sure = window.confirm(`Delete list "${active.name}"? This cannot be undone.`);
    if (!sure) return;
    const out = await apiPost({ op: "delete", id: active.id });
    if (out?.ok) {
      setActiveId("");
      await refresh();
    }
  }

  return (
    <div style={{ display: "flex", gap: 16 }}>
      {/* LEFT: list index */}
      <div
        style={{
          width: 320,
          flex: "0 0 320px",
          borderRight: "1px solid rgba(0,0,0,0.08)",
          paddingRight: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>Lists</h1>
          <button onClick={refresh} disabled={loading}>
            Refresh
          </button>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search lists…"
            style={{ flex: 1 }}
          />
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          {loading ? "Loading…" : `${filtered.length} lists`}
        </div>

        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((l) => {
            const activeNow = l.id === activeId;
            return (
              <button
                key={l.id}
                onClick={() => setActiveId(l.id)}
                style={{
                  textAlign: "left",
                  padding: "10px 10px",
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: activeNow ? "rgba(0,0,0,0.06)" : "white",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 800 }}>{l.name}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {l.techIds?.length || 0} targets · updated {fmtDate(l.updatedAt)}
                </div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>{l.id}</div>
              </button>
            );
          })}

          {!loading && !filtered.length && (
            <div style={{ fontSize: 13, opacity: 0.75, marginTop: 8 }}>
              No lists match your search.
            </div>
          )}
        </div>

        <div style={{ marginTop: 14, fontSize: 12, opacity: 0.75 }}>
          Tip: create lists in{" "}
          <Link href="/dashboard/targets" style={{ textDecoration: "underline" }}>
            Targets
          </Link>{" "}
          from current filters.
        </div>
      </div>

      {/* RIGHT: active list detail */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!active ? (
          <div style={{ padding: 12, opacity: 0.8 }}>
            Select a list on the left.
          </div>
        ) : (
          <div style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>List</div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{active.name}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {active.id} · {active.techIds?.length || 0} targets
                </div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Created: {fmtDate(active.createdAt)} · Updated: {fmtDate(active.updatedAt)}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button onClick={onDelete} style={{ borderColor: "rgba(200,0,0,0.35)" }}>
                  Delete
                </button>
              </div>
            </div>

            {/* Rename */}
            <div style={{ marginTop: 14, padding: 12, border: "1px solid rgba(0,0,0,0.10)", borderRadius: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Rename</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button onClick={onRename} disabled={!newName.trim() || newName.trim() === active.name}>
                  Save
                </button>
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginTop: 14, padding: 12, border: "1px solid rgba(0,0,0,0.10)", borderRadius: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Notes</div>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={6}
                style={{ width: "100%", resize: "vertical" }}
                placeholder="Call plan, pitch angle, owner name, follow-up dates…"
              />
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <button onClick={onSaveNotes} disabled={notesDraft === (active.notes || "")}>
                  Save notes
                </button>
              </div>
            </div>

            {/* Filters snapshot */}
            <div style={{ marginTop: 14, padding: 12, border: "1px solid rgba(0,0,0,0.10)", borderRadius: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                <div style={{ fontWeight: 800 }}>Filters snapshot</div>
                <button onClick={onSaveFiltersSnapshot}>Re-save snapshot</button>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8, whiteSpace: "pre-wrap" }}>
                {safeJsonPreview(active.filters, 900)}
              </div>
            </div>

            {/* Quick actions */}
            <div style={{ marginTop: 14, padding: 12, border: "1px solid rgba(0,0,0,0.10)", borderRadius: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Quick actions</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => (window.location.href = `/dashboard/targets?listId=${encodeURIComponent(active.id)}`)}
                >
                  Open in Targets
                </button>
                <button
                  onClick={() =>
                    (window.location.href = `/api/targets/export?listId=${encodeURIComponent(active.id)}&format=csv`)
                  }
                >
                  Export CSV
                </button>
                <button
                  onClick={() => window.open(`/dashboard/targets/print?listId=${encodeURIComponent(active.id)}`, "_blank")}
                >
                  Print
                </button>
              </div>
            </div>

            {/* Membership summary */}
            <div style={{ marginTop: 14, padding: 12, border: "1px solid rgba(0,0,0,0.10)", borderRadius: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Targets</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                This page is list management; editing membership happens fastest in Targets (filters + bulk add/remove).
              </div>
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                Targets count: <b>{active.techIds?.length || 0}</b>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
