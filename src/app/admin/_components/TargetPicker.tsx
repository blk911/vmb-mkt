"use client";

import React from "react";

type TargetPickerProps = {
  item: {
    id: string;
    name?: string;
    city?: string;
    zip?: string;
    sizeBand?: string;
    [key: string]: any;
  };
};

export default function TargetPicker({ item }: TargetPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [lists, setLists] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [newListName, setNewListName] = React.useState("");

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

  const handleAddToList = async (listId: string) => {
    try {
      const res = await fetch(`/api/admin/targets/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              kind: "facility", // TODO: determine from item
              refId: item.id,
              addressId: item.addressKey || item.id,
              label: item.name || item.businessName || item.id,
              city: item.city,
              zip: item.zip || item.zip5,
              sizeBand: item.sizeBand,
            },
          ],
        }),
      });

      const j = await res.json();
      if (j.ok) {
        setOpen(false);
        alert("Added to target list!");
      } else {
        alert(`Error: ${j.error}`);
      }
    } catch (e: any) {
      alert(`Error: ${e?.message}`);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newListName.trim()) {
      alert("Please enter a list name");
      return;
    }

    try {
      setCreating(true);
      const res = await fetch("/api/admin/targets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newListName.trim(),
          scope: "facility", // TODO: determine from item
        }),
      });

      const j = await res.json();
      if (j.ok && j.list) {
        await handleAddToList(j.list.id);
        setNewListName("");
      } else {
        alert(`Error: ${j.error}`);
      }
    } catch (e: any) {
      alert(`Error: ${e?.message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1 text-xs border border-neutral-200 rounded-lg hover:bg-neutral-50 font-bold"
        title="Add to target list"
      >
        + Target
      </button>

      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Add to Target List</h3>
              <button
                onClick={() => {
                  setOpen(false);
                  setNewListName("");
                }}
                className="text-xl opacity-70 hover:opacity-100"
              >
                ×
              </button>
            </div>

            {loading ? (
              <div className="text-center py-4 opacity-70">Loading lists...</div>
            ) : (
              <>
                <div className="mb-4">
                  <div className="text-sm font-bold mb-2">Select existing list:</div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {lists.length === 0 ? (
                      <div className="text-sm opacity-70 italic">No lists yet</div>
                    ) : (
                      lists.map((list) => (
                        <button
                          key={list.id}
                          onClick={() => handleAddToList(list.id)}
                          className="w-full text-left px-3 py-2 border border-neutral-200 rounded-lg hover:bg-neutral-50"
                        >
                          <div className="font-bold">{list.name}</div>
                          <div className="text-xs opacity-70">
                            {list.scope} · {list.itemCount || 0} items
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="border-t border-neutral-200 pt-4">
                  <div className="text-sm font-bold mb-2">Or create new list:</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="List name..."
                      className="flex-1 px-3 py-2 border border-neutral-200 rounded-lg"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateAndAdd();
                      }}
                    />
                    <button
                      onClick={handleCreateAndAdd}
                      disabled={creating || !newListName.trim()}
                      className="px-4 py-2 bg-black text-white rounded-lg font-bold disabled:opacity-50"
                    >
                      {creating ? "..." : "Create"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
