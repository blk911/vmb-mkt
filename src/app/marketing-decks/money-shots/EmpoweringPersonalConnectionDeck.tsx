"use client";

/**
 * Presentation #6 — Empowering Personal Connection (SALONs money-shots).
 * Step 1: flat anchor layout — Client center, personal care left, client world right.
 */

const PERSONAL_CARE_OPTIONS = [
  "Nails",
  "Hair",
  "Extensions",
  "Cut / Color",
  "Lips",
  "Brows",
  "Waxing",
  "Spa",
  "Massage",
  "Mani / Pedi",
] as const;

const CLIENT_WORLD_OPTIONS = [
  "Friend",
  "Family",
  "Co-worker",
  "Instagram",
  "TikTok",
  "Routine",
  "Events",
] as const;

export default function EmpoweringPersonalConnectionDeck() {
  return (
    <div className="w-full min-w-0 rounded-2xl border border-neutral-200/90 bg-gradient-to-b from-white to-neutral-50/80 p-6 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] md:p-8">
      <div className="mb-6 flex flex-col gap-1 border-b border-neutral-200/80 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Empowering Personal Connection
          </p>
        </div>
      </div>

      {/* min-h avoids zero-height flex bugs; grid + minmax(0,1fr) prevents horizontal clip inside overflow-hidden parents */}
      <div className="relative w-full min-w-0 overflow-x-auto overflow-y-visible bg-white px-2 py-8 md:px-6 md:py-12">
        <div className="mx-auto grid w-full min-w-0 max-w-5xl grid-cols-1 items-center gap-y-10 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-x-8 md:gap-y-0 lg:gap-x-12 xl:gap-x-20">
          <aside className="flex min-w-0 flex-col items-end gap-2.5 justify-self-stretch md:justify-self-end">
            {PERSONAL_CARE_OPTIONS.map((label) => (
              <span
                key={label}
                className="block w-full max-w-[13rem] rounded-full border border-neutral-200/90 bg-neutral-50/95 px-4 py-2.5 text-center text-base font-medium leading-snug text-neutral-700 shadow-sm"
              >
                {label}
              </span>
            ))}
          </aside>

          <div className="flex min-w-0 shrink-0 flex-col items-center justify-self-center text-center md:-translate-y-2">
            <div className="rounded-2xl bg-neutral-800 px-10 py-7 shadow-md md:px-12 md:py-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">CLIENT</p>
              <p className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-white md:text-[1.65rem]">
                Client
              </p>
              <p className="mt-2 text-sm leading-snug text-neutral-400">chooses where to go</p>
            </div>
          </div>

          <aside className="flex min-w-0 flex-col items-start gap-2.5 justify-self-stretch md:justify-self-start">
            {CLIENT_WORLD_OPTIONS.map((label) => (
              <span
                key={label}
                className="block w-full max-w-[13rem] rounded-full border border-neutral-200/90 bg-neutral-50/95 px-4 py-2.5 text-center text-base font-medium leading-snug text-neutral-700 shadow-sm"
              >
                {label}
              </span>
            ))}
          </aside>
        </div>
      </div>

      <div className="mt-6 grid w-full grid-cols-1 items-center gap-3 border-t border-neutral-200/80 pt-5 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <button
          type="button"
          disabled
          aria-label="Back"
          className="justify-self-start rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          Back
        </button>
        <p className="text-center text-[11px] text-neutral-500 sm:px-2">Next advances the story</p>
        <button
          type="button"
          disabled
          aria-label="Next"
          className="justify-self-end rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40 sm:justify-self-end"
        >
          Next
        </button>
      </div>
    </div>
  );
}
