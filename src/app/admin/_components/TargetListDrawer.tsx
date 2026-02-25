"use client";

import React from "react";
import type { TargetList } from "../_lib/targets/types";

type TargetListDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export default function TargetListDrawer({ open, onClose }: TargetListDrawerProps) {
  const [lists, setLists] = React.useState<any[]>([]);
  const [selectedList, setSelectedList] = React.useState<TargetList | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      loadLists();
    }
  }, [open]);

  const loadLists = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/targets/list", { cache: "no-store" });
      const j = await res.json();
      if (j.ok) {
        setLists(j.lists || []);
      }
    } catch (e) {
      console.error("Failed to load target lists:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadListDetail = async (listId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/targets/${listId}`, { cache: "no-store" });
      const j = await res.json();
      if (j.ok) {
        setSelectedList(j.list);
      }
    } catch (e) {
      console.error("Failed to load list detail:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (listId: string, format: "csv" | "json") => {
    try {
      const res = await fetch(`/api/admin/targets/${listId}/export?format=${format}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `targets_${listId}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Export error: ${e?.message}`);
    }
  };

  const handleRemoveItem = async (listId: string, refId: string) => {
    if (!confirm("Remove this item?")) return;

    try {
      const res = await fetch(`/api/admin/targets/${listId}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refIds: [refId] }),
      });

      const j = await res.json();
      if (j.ok) {
        await loadListDetail(listId);
        await loadLists();
      } else {
        alert(`Error: ${j.error}`);
      }
    } catch (e: any) {
      alert(`Error: ${e?.message}`);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Target Lists</h2>
          <button
            onClick={onClose}
            className="text-xl opacity-70 hover:opacity-100"
          >
            ×
          </button>
        </div>

        {loading && !selectedList && (
          <div className="text-center py-8 opacity-70">Loading...</div>
        )}

        {!selectedList ? (
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-2">
              {lists.length === 0 ? (
                <div className="text-center py-8 opacity-70">No target lists yet</div>
              ) : (
                lists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => loadListDetail(list.id)}
                    className="w-full text-left px-4 py-3 border border-neutral-200 rounded-lg hover:bg-neutral-50"
                  >
                    <div className="font-bold">{list.name}</div>
                    <div className="text-sm opacity-70">
                      {list.scope} · {list.itemCount || 0} items · Updated {new Date(list.updatedAt).toLocaleDateString()}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <button
                  onClick={() => setSelectedList(null)}
                  className="text-sm opacity-70 hover:opacity-100 mb-2"
                >
                  ← Back
                </button>
                <h3 className="text-lg font-bold">{selectedList.name}</h3>
                <div className="text-sm opacity-70">
                  {selectedList.scope} · {selectedList.items.length} items
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport(selectedList.id, "csv")}
                  className="px-3 py-2 border border-neutral-200 rounded-lg text-sm font-bold hover:bg-neutral-50"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => handleExport(selectedList.id, "json")}
                  className="px-3 py-2 border border-neutral-200 rounded-lg text-sm font-bold hover:bg-neutral-50"
                >
                  Export JSON
                </button>
              </div>
            </div>

            <div className="border border-neutral-200 rounded-lg overflow-hidden">
              <table className="w-full border-collapse">
                <thead className="bg-neutral-50 text-left">
                  <tr className="text-xs opacity-80">
                    <th className="px-3 py-2">Label</th>
                    <th className="px-3 py-2">City</th>
                    <th className="px-3 py-2">Zip</th>
                    <th className="px-3 py-2">Size</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedList.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center opacity-70">
                        No items
                      </td>
                    </tr>
                  ) : (
                    selectedList.items.map((item, i) => (
                      <tr key={i} className="border-t border-neutral-100">
                        <td className="px-3 py-2 text-sm">{item.label}</td>
                        <td className="px-3 py-2 text-sm">{item.city || "—"}</td>
                        <td className="px-3 py-2 text-sm">{item.zip || "—"}</td>
                        <td className="px-3 py-2 text-sm">{item.sizeBand || "—"}</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => handleRemoveItem(selectedList.id, item.refId)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
