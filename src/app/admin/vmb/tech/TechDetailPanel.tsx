"use client";

import React from "react";

type Tech = {
  techId: string;
  licenseNumber: string;
  name: string;
  licenses: Array<{
    licenseNumber: string;
    licenseType: string;
    status: string;
    expireDate: string | null;
    renewedDate: string | null;
  }>;
  services: string[];
  active: boolean;
  salons: Array<{
    salonId: string;
    role: string;
    since: string;
  }>;
  addresses: Array<{
    addressId: string;
    street1: string;
    city: string;
    state: string;
    zip5: string;
    cityKey: string;
    cityLabel: string;
    active: boolean;
  }>;
  signals: {
    densityScore: number;
    demandScore: number;
    networkScore: number;
  };
};

export default function TechDetailPanel({
  techId,
  onClose,
}: {
  techId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [tech, setTech] = React.useState<Tech | null>(null);

  React.useEffect(() => {
    if (!techId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/admin/dora/truth/tech/${encodeURIComponent(techId)}`, { cache: "no-store" });
        const j = await res.json();
        if (cancelled) return;
        if (!j.ok) {
          setErr(j.error || "Failed to load tech");
          return;
        }
        setTech(j.tech);
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message || "Fetch error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [techId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold">Tech Details</h2>
          <button onClick={onClose} className="text-sm hover:opacity-70">
            Close
          </button>
        </div>

        {loading && <div className="p-4">Loading…</div>}
        {err && <div className="p-4 text-red-600 font-semibold">{err}</div>}

        {!loading && !err && tech && (
          <div className="space-y-6">
            {/* Top Card */}
            <div className="border border-neutral-200 rounded-xl p-4">
              <div className="text-xl font-extrabold mb-2">{tech.name || tech.techId}</div>
              <div className="text-sm opacity-70 font-mono mb-4">License: {tech.licenseNumber}</div>
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="opacity-70">Status:</span> <span className="font-semibold">{tech.active ? "Active" : "Inactive"}</span>
                </div>
                <div>
                  <span className="opacity-70">Services:</span>{" "}
                  <span className="font-semibold">{tech.services.join(", ") || "None"}</span>
                </div>
              </div>
            </div>

            {/* Licenses */}
            <div>
              <h3 className="text-sm font-extrabold mb-2">Licenses</h3>
              <div className="space-y-2">
                {tech.licenses.map((license, i) => (
                  <div key={i} className="border border-neutral-200 rounded p-3 text-sm">
                    <div className="font-medium">{license.licenseType || "Unknown"}</div>
                    <div className="text-xs opacity-70 mt-1">
                      Status: {license.status || "—"} • Expires: {license.expireDate || "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Salon Affiliations */}
            <div>
              <h3 className="text-sm font-extrabold mb-2">Salon Affiliations ({tech.salons.length})</h3>
              {tech.salons.length === 0 ? (
                <div className="text-sm opacity-70">No salon affiliations</div>
              ) : (
                <div className="space-y-2">
                  {tech.salons.map((salon, i) => (
                    <div key={i} className="border border-neutral-200 rounded p-3 text-sm">
                      <div className="font-medium">Salon ID: {salon.salonId}</div>
                      <div className="text-xs opacity-70 mt-1">
                        Role: {salon.role || "—"} • Since: {salon.since || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Address Footprint */}
            <div>
              <h3 className="text-sm font-extrabold mb-2">Address Footprint ({tech.addresses.length})</h3>
              {tech.addresses.length === 0 ? (
                <div className="text-sm opacity-70">No addresses</div>
              ) : (
                <div className="space-y-2">
                  {tech.addresses.map((addr, i) => (
                    <div key={i} className="border border-neutral-200 rounded p-3 text-sm">
                      <div className="font-medium">{addr.street1 || "—"}</div>
                      <div className="text-xs opacity-70 mt-1">
                        {addr.cityLabel} {addr.zip5 ? `• ${addr.zip5}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Signals */}
            <div>
              <h3 className="text-sm font-extrabold mb-2">Signals</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="border border-neutral-200 rounded p-3">
                  <div className="text-xs opacity-70">Density Score</div>
                  <div className="text-lg font-extrabold">{tech.signals.densityScore}</div>
                </div>
                <div className="border border-neutral-200 rounded p-3">
                  <div className="text-xs opacity-70">Demand Score</div>
                  <div className="text-lg font-extrabold">{tech.signals.demandScore}</div>
                </div>
                <div className="border border-neutral-200 rounded p-3">
                  <div className="text-xs opacity-70">Network Score</div>
                  <div className="text-lg font-extrabold">{tech.signals.networkScore}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
