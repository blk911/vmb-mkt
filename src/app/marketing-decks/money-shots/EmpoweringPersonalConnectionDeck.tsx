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

const CLIENT_WORLD_OPTIONS = ["Friend", "Family", "Work", "Social", "Routine", "Events"] as const;

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

      <div className="relative overflow-hidden bg-white px-3 py-8 md:px-8 md:py-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-10 md:flex-row md:items-center md:justify-center md:gap-12 lg:gap-16 xl:gap-24">
          <aside className="flex w-full max-w-[12rem] shrink-0 flex-col gap-2.5 md:max-w-[13rem]">
            {PERSONAL_CARE_OPTIONS.map((label) => (
              <span
                key={label}
                className="w-full min-w-[10rem] rounded-full border border-neutral-200/90 bg-neutral-50/95 px-4 py-2.5 text-center text-base font-medium leading-snug text-neutral-700 shadow-sm"
              >
                {label}
              </span>
            ))}
          </aside>

          <div className="flex shrink-0 flex-col items-center text-center md:-translate-y-2">
            <div className="rounded-2xl bg-neutral-800 px-10 py-7 shadow-md md:px-12 md:py-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">CLIENT</p>
              <p className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-white md:text-[1.65rem]">
                Client
              </p>
              <p className="mt-2 text-sm leading-snug text-neutral-400">chooses where to go</p>
            </div>
          </div>

          <aside className="flex w-full max-w-[12rem] shrink-0 flex-col gap-2.5 md:max-w-[13rem]">
            {CLIENT_WORLD_OPTIONS.map((label) => (
              <span
                key={label}
                className="w-full min-w-[10rem] rounded-full border border-neutral-200/90 bg-neutral-50/95 px-4 py-2.5 text-center text-base font-medium leading-snug text-neutral-700 shadow-sm"
              >
                {label}
              </span>
            ))}
          </aside>
        </div>
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
        <p className="text-center text-[11px] text-neutral-500 md:flex-1">Next advances the story</p>
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
