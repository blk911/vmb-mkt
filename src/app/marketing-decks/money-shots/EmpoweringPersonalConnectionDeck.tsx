"use client";

import { useCallback, useState } from "react";

/**
 * Presentation #6 — Empowering Personal Connection (SALONs money-shots).
 * Step 1: Client card above DTC map (vertical stack, not layered); balanced vertical gaps; map ~600px full color; personal care right; no network column.
 * Step 2: three-column layout; Client center; personal care left; client world right (symmetric outer margins).
 * Step 3: "Deb Dazzles / VMB Nail Salon" card left; Client / "VMB Co-Mkt Team" center; Friends group + Instagram stats right.
 * Step 4: left stack of salon cards; right stack with VMB Client over Friends + Instagram.
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

const TOTAL_STEPS = 4;

const STEP_TAGLINES = [
  "Clients have options. Loyalty—without connection—is fragile.",
  "THE CLIENT IS THE HUB — SERVICES FLOW IN, INFLUENCE FLOWS OUT",
  "Clients loyalty = Success -- VMB Incentives unlock YOUR hidden revenue",
  "Clients loyalty = Success -- VMB Incentives unlock YOUR hidden revenue",
] as const;

/** Step-specific center cards for Steps 1 and 2. */
type CenterCardConfig = {
  kicker?: string;
  title: string;
  subtitle: string;
};

const STEP1_CENTER_CARD: CenterCardConfig = {
  title: "Clients",
  subtitle: "Choose salons and techs",
};

const STEP2_CENTER_CARD: CenterCardConfig = {
  title: "Clients",
  subtitle: "The Industry Hub",
};

const pillClassName =
  "block w-full max-w-[13rem] rounded-full border border-neutral-200/90 bg-neutral-50/95 px-4 py-2.5 text-center text-base font-medium leading-snug text-neutral-700 shadow-sm";

function CenterCard({ config }: { config: CenterCardConfig }) {
  return (
    <div className="rounded-2xl bg-neutral-800 px-10 py-7 shadow-md md:px-12 md:py-8">
      {config.kicker ? (
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">{config.kicker}</p>
      ) : null}
      <p
        className={`text-2xl font-semibold leading-tight tracking-tight text-white md:text-[1.65rem] ${config.kicker ? "mt-2" : ""}`}
      >
        {config.title}
      </p>
      <p className="mt-2 text-base leading-snug text-neutral-400 md:text-lg">{config.subtitle}</p>
    </div>
  );
}

function PersonalCareStack({ align }: { align: "left" | "right" }) {
  const justify = align === "right" ? "items-end md:items-end" : "items-start md:items-start";
  return (
    <aside className={`flex min-w-0 flex-col gap-2.5 justify-self-stretch ${justify}`}>
      {PERSONAL_CARE_OPTIONS.map((label) => (
        <span key={label} className={pillClassName}>
          {label}
        </span>
      ))}
    </aside>
  );
}

const STEP1_MAP_SRC = "/empowering-personal-connection-dtc-map.png";
/** Native asset 866×563; display width 600px keeps proportion. */
const STEP1_MAP_W = 600;
const STEP1_MAP_H = Math.round((563 * STEP1_MAP_W) / 866);

/** Step 1 — Client card then map in document order (no overlay); map full color; personal care column on the right. */
function StepOneFrame() {
  return (
    <div className="relative w-full min-w-0 overflow-x-auto overflow-y-visible bg-white px-2 py-8 md:px-6 md:py-12">
      <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col items-stretch gap-10 md:flex-row md:items-center md:gap-12 lg:gap-16 xl:gap-20">
        <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-8 py-2 md:gap-10 md:py-4">
          <div className="w-full px-2 text-center">
            <div className="mx-auto inline-block">
              <CenterCard config={STEP1_CENTER_CARD} />
            </div>
          </div>
          <div className="flex w-full justify-center px-2" aria-hidden>
            <img
              src={STEP1_MAP_SRC}
              alt=""
              width={STEP1_MAP_W}
              height={STEP1_MAP_H}
              className="h-auto w-[600px] max-w-[min(100%,600px)] -translate-x-8 select-none md:-translate-x-12"
            />
          </div>
        </div>
        <PersonalCareStack align="right" />
      </div>
    </div>
  );
}

/** Step 2 — Client center, personal care left, client world right; outer L/R padding matched via symmetric grid and right column aligned to the outer edge. */
function ThreeColumnFrame() {
  return (
    <div className="relative w-full min-w-0 overflow-x-auto overflow-y-visible bg-white px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto grid w-full min-w-0 max-w-5xl grid-cols-1 items-center gap-y-10 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-x-8 md:gap-y-0 lg:gap-x-12 xl:gap-x-20">
        <PersonalCareStack align="left" />

        <div className="flex min-w-0 shrink-0 flex-col items-center justify-self-center text-center md:-translate-y-2">
          <CenterCard config={STEP2_CENTER_CARD} />
        </div>

        <aside className="flex w-full min-w-0 flex-col items-center gap-2.5 justify-self-stretch md:items-end">
          {CLIENT_WORLD_OPTIONS.map((label) => (
            <span key={label} className={pillClassName}>
              {label}
            </span>
          ))}
        </aside>
      </div>
    </div>
  );
}

const STEP3_CENTER_CARD: CenterCardConfig = {
  title: "Client",
  subtitle: "VMB Co-Mkt Team",
};

const STEP3_FRIENDS_SUBS = ["KPI Sisters", "Workouts", "Travel Group"] as const;
const STEP3_INSTA_STATS = ["411 posts", "497K followers", "1,672 following"] as const;

/** Step 3 — "Deb Dazzles / VMB Nail Salon" left; Client / VMB Co-Mkt Team center; Friends group + Instagram stats right. */
function StepThreeFrame() {
  return (
    <div className="relative w-full min-w-0 overflow-x-auto overflow-y-visible bg-white px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col items-center gap-10 md:flex-row md:items-center md:justify-between md:gap-10 lg:gap-12">
        {/* Left — salon contact card */}
        <aside className="flex w-full min-w-0 flex-1 flex-col items-center md:flex-[1_1_0%] md:items-end md:justify-center md:pr-2">
          <div className="rounded-2xl border border-neutral-200/90 bg-neutral-50/95 px-5 py-4 text-center shadow-sm">
            <p className="text-base font-semibold leading-snug text-neutral-800">Deb Dazzles</p>
            <p className="mt-0.5 text-xs font-medium text-neutral-500">VMB Nail Salon</p>
          </div>
        </aside>

        {/* Center — Client card with Step 3 subtitle */}
        <div className="flex shrink-0 flex-col items-center px-2 text-center md:px-4">
          <CenterCard config={STEP3_CENTER_CARD} />
        </div>

        {/* Right — Friends group + Instagram stats */}
        <aside className="flex w-full min-w-0 flex-1 flex-col items-center gap-3 md:flex-[1_1_0%] md:items-start md:justify-center md:pl-1">
          {/* Friends group card */}
          <div className="w-full max-w-[13rem] rounded-2xl border border-neutral-200/90 bg-neutral-50/95 px-4 py-3 shadow-sm text-center">
            <p className="text-sm font-semibold text-neutral-700">Friends</p>
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
              {STEP3_FRIENDS_SUBS[0]}
              <br />
              {STEP3_FRIENDS_SUBS[1]}
              <br />
              {STEP3_FRIENDS_SUBS[2]}
            </p>
          </div>

          {/* Instagram card */}
          <div className="w-full max-w-[13rem] rounded-2xl border border-neutral-200/90 bg-neutral-50/95 px-4 py-3 shadow-sm text-center">
            <p className="text-sm font-semibold text-neutral-700">Instagram</p>
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
              {STEP3_INSTA_STATS[0]}
              <br />
              {STEP3_INSTA_STATS[1]}
              <br />
              {STEP3_INSTA_STATS[2]}
            </p>
          </div>
        </aside>

      </div>
    </div>
  );
}

/** Step 4 — left salon stack; right stack is VMB Client (small) over Friends and Instagram cards. */
function StepFourFrame() {
  return (
    <div className="relative w-full min-w-0 overflow-x-auto overflow-y-visible bg-white px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col items-center gap-10 md:flex-row md:items-center md:justify-between md:gap-10 lg:gap-12">
        {/* Left — salon stack */}
        <aside className="flex w-full min-w-0 flex-1 flex-col items-center gap-3 md:flex-[1_1_0%] md:items-end md:justify-center md:pr-2">
          <div className="w-full max-w-[13rem] rounded-2xl bg-neutral-800 px-4 py-3 text-center shadow-md">
            <p className="text-3xl font-semibold leading-tight tracking-tight text-white">VMB Salons</p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-300">VMB Salon Networks</p>
          </div>

          <div className="w-full max-w-[13rem] rounded-2xl border border-neutral-200/90 bg-neutral-50/95 px-5 py-4 text-center shadow-sm">
            <p className="text-base font-semibold leading-snug text-neutral-800">Deb Dazzles</p>
            <p className="mt-0.5 text-xs font-medium text-neutral-500">VMB Nail Salon</p>
          </div>

          <div className="w-full max-w-[13rem] rounded-2xl border border-neutral-200/90 bg-neutral-50/95 px-5 py-4 text-center shadow-sm">
            <p className="text-base font-semibold leading-snug text-neutral-800">Rose Petals</p>
            <p className="mt-0.5 text-xs font-medium text-neutral-500">VMB Spa</p>
          </div>

          <div className="w-full max-w-[13rem] rounded-2xl border border-neutral-200/90 bg-neutral-50/95 px-5 py-4 text-center shadow-sm">
            <p className="text-base font-semibold leading-snug text-neutral-800">Blown Away</p>
            <p className="mt-0.5 text-xs font-medium text-neutral-500">VMB Hair Salon</p>
          </div>
        </aside>

        {/* Spacer keeps left stack position while right stack stays far right */}
        <div className="hidden md:block md:flex-[1_1_0%]" />

        {/* Right — small Client card stacked over Friends + Instagram */}
        <aside className="flex w-full min-w-0 flex-1 flex-col items-center gap-3 md:flex-[1_1_0%] md:items-start md:justify-center md:pl-1">
          <div className="w-full max-w-[13rem] rounded-2xl bg-neutral-800 px-4 py-3 text-center shadow-md">
            <p className="text-3xl font-semibold leading-tight tracking-tight text-white">VMB Client</p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-300">VMB Co-Mkt Team</p>
          </div>

          <div className="w-full max-w-[13rem] rounded-2xl border border-neutral-200/90 bg-neutral-50/95 px-4 py-3 shadow-sm text-center">
            <p className="text-sm font-semibold text-neutral-700">Friends</p>
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
              {STEP3_FRIENDS_SUBS[0]}
              <br />
              {STEP3_FRIENDS_SUBS[1]}
              <br />
              {STEP3_FRIENDS_SUBS[2]}
            </p>
          </div>

          <div className="w-full max-w-[13rem] rounded-2xl border border-neutral-200/90 bg-neutral-50/95 px-4 py-3 shadow-sm text-center">
            <p className="text-sm font-semibold text-neutral-700">Instagram</p>
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
              {STEP3_INSTA_STATS[0]}
              <br />
              {STEP3_INSTA_STATS[1]}
              <br />
              {STEP3_INSTA_STATS[2]}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PresentationStepFrame({ stepIndex }: { stepIndex: number }) {
  return (
    <>
      <div className="mb-6 border-b border-neutral-200/80 pb-5 text-center">
        <div className="mx-auto w-full max-w-3xl">
          <p className="mb-1 text-[11px] font-medium tabular-nums text-neutral-500">
            Step {stepIndex + 1} of {TOTAL_STEPS}
          </p>
          <p className="font-sans text-[18px] font-semibold uppercase leading-tight tracking-tight text-neutral-900">
            {STEP_TAGLINES[stepIndex]}
          </p>
        </div>
      </div>

      {stepIndex === 0 ? (
        <StepOneFrame />
      ) : stepIndex === 1 ? (
        <ThreeColumnFrame />
      ) : stepIndex === 2 ? (
        <StepThreeFrame />
      ) : (
        <StepFourFrame />
      )}
    </>
  );
}

export default function EmpoweringPersonalConnectionDeck() {
  const [step, setStep] = useState(0);
  const atFirst = step === 0;
  const atLast = step >= TOTAL_STEPS - 1;

  const handleBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const handleNext = useCallback(() => {
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  }, []);

  return (
    <div className="w-full min-w-0 rounded-2xl border border-neutral-200/90 bg-gradient-to-b from-white to-neutral-50/80 p-6 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] md:p-8">
      <PresentationStepFrame stepIndex={step} />

      <div className="mt-4 rounded-xl border border-neutral-200/80 bg-white/80 px-4 py-3 text-center font-sans text-[18px] font-semibold leading-tight tracking-tight text-neutral-900 md:px-5">
        Clients are not just buyers. They are the connection point between services, salons, technicians, and future
        bookings.
      </div>

      <div className="mt-6 grid w-full grid-cols-1 items-center gap-3 border-t border-neutral-200/80 pt-5 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <button
          type="button"
          disabled={atFirst}
          onClick={handleBack}
          aria-label="Back"
          className="justify-self-start rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Back
        </button>
        <p className="text-center text-[11px] text-neutral-500 sm:px-2">
          {atLast ? "End of sequence — edit Step 4 or add more steps later." : "Next advances the story"}
        </p>
        <button
          type="button"
          disabled={atLast}
          onClick={handleNext}
          aria-label="Next"
          className="justify-self-end rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 sm:justify-self-end"
        >
          Next
        </button>
      </div>
    </div>
  );
}
