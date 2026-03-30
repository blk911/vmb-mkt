"use client";

/**
 * Presentation #6 — Empowering Personal Connection (SALONs money-shots).
 * Shell only: add slides / content in this file when ready.
 */
export default function EmpoweringPersonalConnectionDeck() {
  return (
    <div className="rounded-2xl border border-neutral-200/90 bg-gradient-to-b from-white to-neutral-50/80 p-6 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] md:p-8">
      <div className="mb-6 flex flex-col gap-1 border-b border-neutral-200/80 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Empowering Personal Connection
          </p>
        </div>
      </div>

      <div className="relative min-h-[420px] overflow-hidden bg-white px-3 py-6 md:min-h-[520px] md:px-8 md:py-10">
        {/* #6 presentation content */}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200/80 pt-5">
        <button
          type="button"
          disabled
          aria-label="Back"
          className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          Back
        </button>
        <div className="min-h-[1.25rem] flex-1 md:text-center" aria-hidden />
        <button
          type="button"
          disabled
          aria-label="Next"
          className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
