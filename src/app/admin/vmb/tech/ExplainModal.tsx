"use client";

import React from "react";

export default function ExplainModal({
  techId,
  explainData,
  onClose,
}: {
  techId: string;
  explainData: any;
  onClose: () => void;
}) {
  if (!explainData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div className="bg-white rounded-xl p-6 max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold">Scoring Explanation</h2>
            <button onClick={onClose} className="text-sm hover:opacity-70">
              Close
            </button>
          </div>
          <div className="text-sm opacity-70">Loading explain data...</div>
        </div>
      </div>
    );
  }

  const signals = explainData.signals || {};
  const inputs = explainData.inputs || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold">Scoring Explanation</h2>
          <button onClick={onClose} className="text-sm hover:opacity-70">
            Close
          </button>
        </div>

        <div className="space-y-4">
          {/* Tech Info */}
          <div className="border border-neutral-200 rounded-xl p-4">
            <div className="text-sm font-extrabold mb-2">Tech ID</div>
            <div className="font-mono text-xs">{techId}</div>
            <div className="text-xs opacity-70 mt-2">Computed: {explainData.computedAt || "—"}</div>
            <div className="text-xs opacity-70">Formula: {explainData.formulaVersion || "—"}</div>
          </div>

          {/* Inputs */}
          <div>
            <h3 className="text-sm font-extrabold mb-2">Inputs</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="border border-neutral-200 rounded p-2">
                <div className="text-xs opacity-70">Salon Count</div>
                <div className="font-semibold">{inputs.salonCount ?? "—"}</div>
              </div>
              <div className="border border-neutral-200 rounded p-2">
                <div className="text-xs opacity-70">Address Count</div>
                <div className="font-semibold">{inputs.addressCount ?? "—"}</div>
              </div>
              <div className="border border-neutral-200 rounded p-2">
                <div className="text-xs opacity-70">Facility Density</div>
                <div className="font-semibold">{inputs.facilityDensity ?? "—"}</div>
              </div>
              <div className="border border-neutral-200 rounded p-2">
                <div className="text-xs opacity-70">Area Key</div>
                <div className="font-mono text-xs">{inputs.areaKey ?? "—"}</div>
              </div>
            </div>
          </div>

          {/* Signals */}
          <div>
            <h3 className="text-sm font-extrabold mb-2">Signals (0-100)</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="border border-neutral-200 rounded p-3">
                <div className="text-xs opacity-70">Total Score</div>
                <div className="text-2xl font-extrabold">{signals.totalScore ?? "—"}</div>
                <div className="text-xs opacity-70 mt-1">
                  Weighted: 40% demand + 25% density + 20% network + 10% mobility + 5% stability
                </div>
              </div>
              <div className="border border-neutral-200 rounded p-3">
                <div className="text-xs opacity-70">Demand</div>
                <div className="text-xl font-extrabold">{signals.demand ?? "—"}</div>
                <div className="text-xs opacity-70 mt-1">50% network + 50% density</div>
              </div>
              <div className="border border-neutral-200 rounded p-3">
                <div className="text-xs opacity-70">Density</div>
                <div className="text-xl font-extrabold">{signals.density ?? "—"}</div>
                <div className="text-xs opacity-70 mt-1">Facilities in area</div>
              </div>
              <div className="border border-neutral-200 rounded p-3">
                <div className="text-xs opacity-70">Network</div>
                <div className="text-xl font-extrabold">{signals.network ?? "—"}</div>
                <div className="text-xs opacity-70 mt-1">70% salons + 30% addresses</div>
              </div>
              <div className="border border-neutral-200 rounded p-3">
                <div className="text-xs opacity-70">Mobility</div>
                <div className="text-xl font-extrabold">{signals.mobility ?? "—"}</div>
                <div className="text-xs opacity-70 mt-1">Multi-salon + addresses</div>
              </div>
              <div className="border border-neutral-200 rounded p-3">
                <div className="text-xs opacity-70">Stability</div>
                <div className="text-xl font-extrabold">{signals.stability ?? "—"}</div>
                <div className="text-xs opacity-70 mt-1">Single salon + address</div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {explainData.notes && explainData.notes.length > 0 && (
            <div>
              <h3 className="text-sm font-extrabold mb-2">Notes</h3>
              <ul className="list-disc list-inside text-sm space-y-1">
                {explainData.notes.map((note: string, i: number) => (
                  <li key={i} className="opacity-70">
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
