"use client";

import React from "react";
import { useRouter } from "next/navigation";

type AddressRow = {
  addressId: string;
  cityKey: string;
  cityLabel: string;
  addressLabel: string;
  street1: string;
  city: string;
  state: string;
  zip5: string;
  regCount: number;
  techCount: number;
  cand: number;
  seg: string;
};

type TechRow = {
  licenseId: string;
  name: string;
  licenseType: string;
  status: string;
  expireDate: string | null;
  renewBy: string | null;
};

export default function CityDrillClient({ cityKey }: { cityKey: string }) {
  const router = useRouter();
  const decodedCityKey = decodeURIComponent(cityKey);

  const [loadingAddresses, setLoadingAddresses] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [addresses, setAddresses] = React.useState<AddressRow[]>([]);
  const [cityLabel, setCityLabel] = React.useState<string>(decodedCityKey);
  const [total, setTotal] = React.useState(0);
  const [activeAddressId, setActiveAddressId] = React.useState<string | null>(null);
  const [techs, setTechs] = React.useState<TechRow[]>([]);
  const [techsLoading, setTechsLoading] = React.useState(false);

  // Filter and pagination state
  const [q, setQ] = React.useState("");
  const [zip, setZip] = React.useState("");
  const [candOnly, setCandOnly] = React.useState(false);
  const [minTech, setMinTech] = React.useState(0);
  const [sort, setSort] = React.useState<"techDesc" | "candDesc" | "zipAsc" | "streetAsc">("techDesc");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(200);

  const [selectedAddresses, setSelectedAddresses] = React.useState<Set<string>>(new Set());
  const [selectedTechs, setSelectedTechs] = React.useState<Set<string>>(new Set());

  const [targetListsOpen, setTargetListsOpen] = React.useState(false);
  const [targetLists, setTargetLists] = React.useState<any[]>([]);
  const [saveName, setSaveName] = React.useState("");
  const [saveOpen, setSaveOpen] = React.useState(false);

  // Reset page to 1 when filters change
  React.useEffect(() => {
    setPage(1);
  }, [q, zip, candOnly, minTech, sort, pageSize, decodedCityKey]);

  // Load addresses for city with filters/pagination
  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      // Build fetch URL with query params
      const p = new URLSearchParams();
      if (q.trim()) p.set("q", q.trim());
      if (zip.trim()) p.set("zip", zip.trim());
      if (candOnly) p.set("cand", "1");
      if (minTech > 0) p.set("minTech", String(minTech));
      p.set("sort", sort);
      p.set("page", String(page));
      p.set("pageSize", String(pageSize));
      const url = `/api/admin/dora/truth/addresses/by-city/${encodeURIComponent(decodedCityKey)}?${p.toString()}`;

      setLoadingAddresses(true);
      setErr(null);
      try {
        const res = await fetch(url, { cache: "no-store" });

        if (!res.ok) {
          const t = await res.text();
          throw new Error(`API ${res.status}: ${t.slice(0, 120)}`);
        }

        const j = await res.json();
        if (cancelled) return;

        if (!j.ok) {
          setErr(j.error || "Failed to load addresses");
          setAddresses([]);
          setTotal(0);
          return;
        }

        setAddresses(j.rows || []);
        setTotal(Number(j.total || 0));

        // Set cityLabel from API response
        const label = j.rows && j.rows[0] && j.rows[0].cityLabel ? j.rows[0].cityLabel : decodedCityKey;
        setCityLabel(label);
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message || "Fetch error");
          setAddresses([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) {
          setLoadingAddresses(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [decodedCityKey, q, zip, candOnly, minTech, sort, page, pageSize]);

  // Load techs for active address
  React.useEffect(() => {
    if (!activeAddressId) {
      setTechs([]);
      return;
    }

    let alive = true;
    (async () => {
      try {
        setTechsLoading(true);
        const res = await fetch(`/api/admin/dora/truth/tech/by-address/${encodeURIComponent(activeAddressId)}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          const t = await res.text();
          throw new Error(`API ${res.status}: ${t.slice(0, 120)}`);
        }

        const j = await res.json();
        if (!alive) return;

        if (!j.ok) {
          setTechs([]);
          return;
        }
        setTechs(j.techs || []);
      } catch (e: any) {
        if (!alive) return;
        setTechs([]);
      } finally {
        if (!alive) return;
        setTechsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeAddressId]);

  // Load target lists
  React.useEffect(() => {
    if (!targetListsOpen) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/vmb/targets/list", { cache: "no-store" });
        const j = await res.json();
        if (!alive) return;
        setTargetLists(j.lists || []);
      } catch {
        if (!alive) return;
        setTargetLists([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [targetListsOpen]);

  const toggleAddressSelection = (addressId: string) => {
    const next = new Set(selectedAddresses);
    if (next.has(addressId)) {
      next.delete(addressId);
    } else {
      next.add(addressId);
    }
    setSelectedAddresses(next);
  };

  const toggleTechSelection = (techId: string) => {
    const next = new Set(selectedTechs);
    if (next.has(techId)) {
      next.delete(techId);
    } else {
      next.add(techId);
    }
    setSelectedTechs(next);
  };

  const handleSaveTarget = async () => {
    if (!saveName.trim()) return;

    try {
      const res = await fetch("/api/admin/vmb/targets/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveName.trim(),
          meta: {},
          selections: {
            addresses: Array.from(selectedAddresses),
            techs: Array.from(selectedTechs),
          },
        }),
      });

      const j = await res.json();
      if (!j.ok) {
        alert(`Error: ${j.error}`);
        return;
      }

      setSaveName("");
      setSaveOpen(false);
      setSelectedAddresses(new Set());
      setSelectedTechs(new Set());
      alert(`Target list saved: ${j.targetId}`);
    } catch (e: any) {
      alert(`Error: ${e?.message || "Failed to save"}`);
    }
  };

  const handleLoadTarget = async (targetId: string) => {
    try {
      const res = await fetch(`/api/admin/vmb/targets/get/${encodeURIComponent(targetId)}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`API ${res.status}: ${t.slice(0, 120)}`);
      }

      const j = await res.json();
      if (!j.ok) {
        alert(`Error: ${j.error || "Failed to load target list"}`);
        return;
      }

      const selections = j.selections || {};
      setSelectedAddresses(new Set(selections.addresses || []));
      setSelectedTechs(new Set(selections.techs || []));
      setTargetListsOpen(false);
    } catch (e: any) {
      alert(`Error: ${e?.message || "Failed to load target list"}`);
    }
  };

  const selectedCount = selectedAddresses.size + selectedTechs.size;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <button
            onClick={() => router.push("/admin/vmb/rollups")}
            className="text-sm opacity-70 hover:opacity-100 mb-2"
          >
            ← Back to Rollups
          </button>
          <h1 className="text-2xl font-semibold">{cityLabel}</h1>
          <div className="text-sm opacity-70">
            {total} addresses • {selectedCount} selected
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTargetListsOpen(true)}
            className="px-4 py-2 rounded-xl border border-neutral-200 font-extrabold"
          >
            Target Lists
          </button>
          <button
            onClick={() => setSaveOpen(true)}
            disabled={selectedCount === 0}
            className="px-4 py-2 rounded-xl bg-black text-white font-extrabold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Target ({selectedCount})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Left: Address List */}
        <div className="border border-neutral-200 rounded-2xl overflow-hidden">
          <div className="bg-neutral-50 p-3 border-b border-neutral-200">
            <div className="text-sm font-extrabold">Addresses</div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-end gap-2 p-2 border-b border-neutral-200">
            <div className="flex flex-col">
              <label className="text-xs opacity-70">Street contains</label>
              <input
                className="px-2 py-1 border border-neutral-200 rounded text-sm"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search street..."
              />
            </div>
            <div className="flex flex-col w-28">
              <label className="text-xs opacity-70">ZIP</label>
              <input
                className="px-2 py-1 border border-neutral-200 rounded text-sm"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="ZIP"
              />
            </div>
            <label className="flex items-center gap-2 text-sm px-2 py-1">
              <input
                type="checkbox"
                checked={candOnly}
                onChange={(e) => setCandOnly(e.target.checked)}
              />
              Cand only
            </label>
            <div className="flex flex-col w-28">
              <label className="text-xs opacity-70">Min Tech</label>
              <input
                type="number"
                className="px-2 py-1 border border-neutral-200 rounded text-sm"
                value={minTech}
                onChange={(e) => setMinTech(Number(e.target.value || 0))}
                min="0"
              />
            </div>
            <div className="flex flex-col w-44">
              <label className="text-xs opacity-70">Sort</label>
              <select
                className="px-2 py-1 border border-neutral-200 rounded text-sm"
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
              >
                <option value="techDesc">Tech ↓</option>
                <option value="candDesc">Cand ↓ then Tech ↓</option>
                <option value="zipAsc">ZIP ↑</option>
                <option value="streetAsc">Street ↑</option>
              </select>
            </div>
            <div className="flex flex-col w-32">
              <label className="text-xs opacity-70">Page size</label>
              <select
                className="px-2 py-1 border border-neutral-200 rounded text-sm"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={300}>300</option>
                <option value={500}>500</option>
              </select>
            </div>
          </div>

          {loadingAddresses && <div className="p-4">Loading…</div>}
          {err && <div className="p-4 text-red-600 font-semibold">{err}</div>}
          {!loadingAddresses && !err && (
            <div className="overflow-y-auto max-h-[600px]">
              <table className="w-full border-collapse">
                <thead className="bg-neutral-50 text-left sticky top-0">
                  <tr className="text-xs opacity-80">
                    <Th>Address</Th>
                    <Th>REG</Th>
                    <Th>Tech</Th>
                    <Th>Cand</Th>
                    <Th>Seg</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {addresses.map((addr) => (
                    <tr
                      key={addr.addressId}
                      className={`border-t border-neutral-100 cursor-pointer hover:bg-neutral-50 ${
                        activeAddressId === addr.addressId ? "bg-blue-50" : ""
                      }`}
                      onClick={() => setActiveAddressId(addr.addressId)}
                    >
                      <Td className="font-medium">{addr.addressLabel}</Td>
                      <Td>{addr.regCount}</Td>
                      <Td>{addr.techCount}</Td>
                      <Td>{addr.cand}</Td>
                      <Td className="text-xs">{addr.seg}</Td>
                      <Td>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAddressSelection(addr.addressId);
                          }}
                          className={`px-2 py-1 text-xs rounded ${
                            selectedAddresses.has(addr.addressId)
                              ? "bg-black text-white"
                              : "border border-neutral-200"
                          }`}
                        >
                          {selectedAddresses.has(addr.addressId) ? "✓" : "+"} Target
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loadingAddresses && !err && (
            <div className="flex items-center justify-between py-2 px-3 border-t border-neutral-200">
              <div className="text-sm opacity-70">
                {total === 0 ? (
                  "No results"
                ) : (
                  <>
                    Showing {Math.min((page - 1) * pageSize + 1, total)}-{Math.min(page * pageSize, total)} of {total}
                  </>
                )}
                {loadingAddresses ? " (loading…)" : ""}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 border border-neutral-200 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={page <= 1 || loadingAddresses}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <div className="text-sm">
                  Page {page} / {Math.max(1, Math.ceil(total / pageSize))}
                </div>
                <button
                  className="px-2 py-1 border border-neutral-200 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={page >= Math.ceil(total / pageSize) || loadingAddresses}
                  onClick={() => setPage((p) => Math.min(Math.ceil(total / pageSize), p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Inspector */}
        <div className="border border-neutral-200 rounded-2xl overflow-hidden">
          <div className="bg-neutral-50 p-3 border-b border-neutral-200">
            <div className="text-sm font-extrabold">
              {activeAddressId ? "Tech Roster" : "Select an address"}
            </div>
          </div>
          {activeAddressId && (
            <div className="p-4">
              {techsLoading && <div>Loading techs…</div>}
              {!techsLoading && techs.length === 0 && <div className="opacity-70">No techs found</div>}
              {!techsLoading && techs.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs opacity-70 mb-2">{techs.length} technicians</div>
                  {techs.map((tech) => (
                    <div
                      key={tech.licenseId}
                      className="border border-neutral-200 rounded p-2 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">{tech.name || "—"}</div>
                        <div className="text-xs opacity-70">
                          {tech.licenseId} • {tech.licenseType || "—"} • {tech.status || "—"}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleTechSelection(tech.licenseId)}
                        className={`px-2 py-1 text-xs rounded ${
                          selectedTechs.has(tech.licenseId)
                            ? "bg-black text-white"
                            : "border border-neutral-200"
                        }`}
                      >
                        {selectedTechs.has(tech.licenseId) ? "✓" : "+"} Target
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Save Target Modal */}
      {saveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h2 className="text-lg font-extrabold mb-4">Save Target List</h2>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Target list name"
              className="w-full px-3 py-2 border border-neutral-200 rounded-xl mb-4"
              autoFocus
            />
            <div className="text-sm opacity-70 mb-4">
              {selectedAddresses.size} addresses • {selectedTechs.size} techs
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSaveOpen(false);
                  setSaveName("");
                }}
                className="flex-1 px-4 py-2 border border-neutral-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTarget}
                disabled={!saveName.trim()}
                className="flex-1 px-4 py-2 bg-black text-white rounded-xl disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Target Lists Drawer */}
      {targetListsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold">Target Lists</h2>
              <button onClick={() => setTargetListsOpen(false)} className="text-sm">Close</button>
            </div>
            {targetLists.length === 0 ? (
              <div className="opacity-70">No saved target lists</div>
            ) : (
              <div className="space-y-2">
                {targetLists.map((list: any) => (
                  <div key={list.targetId} className="border border-neutral-200 rounded p-3 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{list.name}</div>
                      <div className="text-xs opacity-70">
                        {list.counts?.addresses || 0} addresses • {list.counts?.techs || 0} techs •{" "}
                        {new Date(list.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleLoadTarget(list.targetId)}
                      className="px-3 py-1.5 text-sm bg-black text-white rounded-xl font-extrabold hover:opacity-80"
                    >
                      Load
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2">{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-sm ${className}`}>{children}</td>;
}
