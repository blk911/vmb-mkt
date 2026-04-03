"use client";

import { useCallback, useMemo, useState } from "react";

type StepContent = {
  headline: string;
  subhead: string;
  anchor?: string;
  comment: string;
};

const TOTAL_STEPS = 5;

const STEPS: StepContent[] = [
  {
    headline: "You’re working in isolation.",
    subhead: "Every salon operates alone — but your clients don’t.",
    anchor: "You don’t have a network. You have traffic.",
    comment:
      "Salons work hard to drive demand, but without a relationship network, that demand keeps drifting away.",
  },
  {
    headline: "The system is broken.",
    subhead: "Everything you use today is transactional. Nothing builds relationships.",
    anchor: "You’re renting your business every day.",
    comment:
      "Social, booking, and reviews all help in pieces — but none of them create a connected growth engine.",
  },
  {
    headline: "What’s missing?",
    subhead: "There is no client network in personal care.",
    anchor: "The industry has services — but no network.",
    comment:
      "The market has providers and demand, but no shared relationship layer to convert connection into recurring value.",
  },
  {
    headline: "Enter VMB Network.",
    subhead: "VMB turns your clients into a connected revenue network.",
    anchor: "Your clients don’t just book. They bring business.",
    comment:
      "VMB activates what already happens naturally — and turns it into a structured, visible, compounding growth channel.",
  },
  {
    headline: "Why you join.",
    subhead: "No monthly cost. Immediate utility. Long-term upside.",
    comment: "Join. Activate. Grow your client network.",
  },
];

const SERVICE_PILLS = ["nails", "hair", "brows", "lashes", "lips", "wax", "massage", "mani / pedi"] as const;

function HeaderBlock({ step }: { step: number }) {
  const data = STEPS[step];
  return (
    <div className="mb-6 border-b border-neutral-200/80 pb-5 text-center">
      <div className="mx-auto w-full max-w-4xl">
        <p className="mb-1 text-[11px] font-medium tabular-nums text-neutral-500">Step {step + 1} of {TOTAL_STEPS}</p>
        <p className="font-sans text-[18px] font-semibold uppercase leading-tight tracking-tight text-neutral-900">
          {data.headline}
        </p>
        <p className="mt-2 text-sm font-medium text-neutral-600 md:text-base">{data.subhead}</p>
      </div>
    </div>
  );
}

function Slide7A() {
  return (
    <div className="relative w-full min-w-0 bg-white px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-center gap-10 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:gap-12">
        <div className="flex justify-center md:justify-end">
          <div className="w-full max-w-[17rem] rounded-2xl border border-neutral-200/90 bg-neutral-50/95 px-5 py-5 text-center shadow-sm">
            <p className="text-xl font-semibold text-neutral-900">Your Salon</p>
            <p className="mt-1 text-sm text-neutral-500">Strong brand. Isolated growth.</p>
          </div>
        </div>
        <div className="relative">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {SERVICE_PILLS.map((pill) => (
              <span
                key={pill}
                className="rounded-full border border-neutral-200/90 bg-neutral-50/95 px-3 py-2 text-center text-sm font-medium text-neutral-700 shadow-sm"
              >
                {pill}
              </span>
            ))}
          </div>
          <div className="pointer-events-none absolute -left-6 top-1/2 hidden h-px w-10 -translate-y-1/2 border-t border-dashed border-neutral-300 md:block" />
        </div>
      </div>
      <p className="mt-7 text-center text-lg font-semibold tracking-tight text-neutral-900">You don’t have a network. You have traffic.</p>
    </div>
  );
}

function Slide7B() {
  const buckets = useMemo(
    () => [
      {
        title: "Social",
        lines: ["Instagram gives attention, not loyalty"],
      },
      {
        title: "Booking",
        lines: ["Booking apps schedule time, not growth"],
      },
      {
        title: "Review Platforms",
        lines: ["Reviews build static reputation, not recurring client flow"],
      },
    ],
    [],
  );
  return (
    <div className="relative w-full min-w-0 bg-white px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
        {buckets.map((bucket) => (
          <article key={bucket.title} className="rounded-2xl border border-neutral-200/90 bg-neutral-50/95 px-5 py-5 text-center shadow-sm">
            <h4 className="text-base font-semibold text-neutral-900">{bucket.title}</h4>
            <div className="mt-2 space-y-2 text-sm text-neutral-600">
              {bucket.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </article>
        ))}
      </div>
      <p className="mt-3 text-center text-sm text-neutral-600">Discounts create dependency, not real retention.</p>
      <p className="mt-6 text-center text-lg font-semibold tracking-tight text-neutral-900">You’re renting your business every day.</p>
    </div>
  );
}

function Slide7C() {
  const bullets = [
    "No shared relationship graph",
    "No real referral visibility",
    "No client-to-client expansion engine",
    "No monetized connection layer across services",
  ] as const;
  return (
    <div className="relative w-full min-w-0 bg-white px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-center gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="relative min-h-[220px] rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Missing Layer</p>
          <div className="absolute left-[20%] top-[32%] h-16 w-16 rounded-full border border-neutral-300/70" />
          <div className="absolute left-[44%] top-[22%] h-14 w-14 rounded-full border border-neutral-300/70" />
          <div className="absolute left-[62%] top-[44%] h-12 w-12 rounded-full border border-neutral-300/70" />
          <div className="absolute left-[34%] top-[55%] h-14 w-14 rounded-full border border-neutral-300/70" />
          <div className="absolute left-[26%] top-[44%] h-[1px] w-28 border-t border-dashed border-neutral-300/70" />
          <div className="absolute left-[41%] top-[38%] h-[1px] w-24 rotate-[22deg] border-t border-dashed border-neutral-300/70" />
          <div className="absolute left-[39%] top-[56%] h-[1px] w-24 -rotate-[18deg] border-t border-dashed border-neutral-300/70" />
        </div>
        <div className="space-y-2">
          {bullets.map((item) => (
            <p key={item} className="rounded-xl border border-neutral-200/90 bg-neutral-50/95 px-4 py-3 text-sm font-medium text-neutral-700 shadow-sm">
              {item}
            </p>
          ))}
        </div>
      </div>
      <p className="mt-6 text-center text-lg font-semibold tracking-tight text-neutral-900">The industry has services — but no network.</p>
    </div>
  );
}

function Slide7D() {
  const bullets = [
    "Invite-only membership",
    "Built-in co-marketing",
    "Client-to-client discovery",
    "Cross-service expansion",
    "Prepaid booking with no-cancel upside",
    "Recurring income potential from network activity",
  ] as const;
  return (
    <div className="relative w-full min-w-0 bg-white px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="relative min-h-[260px] rounded-2xl border border-neutral-200/90 bg-neutral-50/95 p-5 shadow-sm">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-neutral-800 px-8 py-6 text-center shadow-md">
            <p className="text-2xl font-semibold text-white">VMB Network</p>
            <p className="mt-1 text-sm text-neutral-300">Connected revenue layer</p>
          </div>
          <div className="absolute left-[16%] top-[26%] rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700">Salon</div>
          <div className="absolute left-[66%] top-[24%] rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700">Client</div>
          <div className="absolute left-[72%] top-[62%] rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700">Services</div>
          <div className="absolute left-[20%] top-[66%] rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700">Invites</div>
          <div className="pointer-events-none absolute left-[29%] top-[36%] h-px w-28 border-t border-neutral-400" />
          <div className="pointer-events-none absolute left-[51%] top-[36%] h-px w-20 border-t border-neutral-400" />
          <div className="pointer-events-none absolute left-[50%] top-[58%] h-px w-24 rotate-[12deg] border-t border-neutral-400" />
        </div>
        <div className="space-y-2">
          {bullets.map((item) => (
            <p key={item} className="rounded-xl border border-neutral-200/90 bg-neutral-50/95 px-4 py-3 text-sm font-medium text-neutral-700 shadow-sm">
              {item}
            </p>
          ))}
        </div>
      </div>
      <p className="mt-6 text-center text-lg font-semibold tracking-tight text-neutral-900">Your clients don’t just book. They bring business.</p>
    </div>
  );
}

function Slide7E() {
  const salonBullets = [
    "Immediate revenue with prepay",
    "No cancellations",
    "New clients through the network",
    "Free co-marketing tools",
    "Recurring income potential",
    "Customizable salon web template",
    "Auto calendar and booking flow",
    "No monthly app cost*",
  ] as const;
  const clientBullets = [
    "Gift services in a new way",
    "Discover trusted providers",
    "Invite friends into the network",
    "Access multiple personal care categories",
    "Keep one profile across services",
    "Participate in a curated invite-only ecosystem",
  ] as const;
  return (
    <div className="relative w-full min-w-0 bg-white px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
          <section className="rounded-xl border border-neutral-200/90 bg-neutral-50/95 px-5 py-4 shadow-sm">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-900">For salons</h4>
            <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
              {salonBullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-neutral-500">* $25 annual license verification / monitoring required</p>
          </section>
          <section className="rounded-xl border border-neutral-200/90 bg-neutral-50/95 px-5 py-4 shadow-sm">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-900">For clients</h4>
            <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
              {clientBullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>
        <div className="rounded-2xl border border-neutral-200/90 bg-neutral-800 px-6 py-4 text-center shadow-md">
          <p className="text-lg font-semibold text-white">VMB SALON NETWORK</p>
          <p className="mt-1 text-sm text-neutral-300">Join. Activate. Grow your client network.</p>
          <p className="mt-1 text-xs text-neutral-400">This is bigger than booking.</p>
        </div>
      </div>
    </div>
  );
}

function StepFrame({ step }: { step: number }) {
  if (step === 0) return <Slide7A />;
  if (step === 1) return <Slide7B />;
  if (step === 2) return <Slide7C />;
  if (step === 3) return <Slide7D />;
  return <Slide7E />;
}

export default function InviteOnlyNetworkDeck() {
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
      <HeaderBlock step={step} />
      <StepFrame step={step} />

      <div className="mt-4 rounded-xl border border-neutral-200/80 bg-white/80 px-4 py-3 text-center font-sans text-[18px] font-semibold leading-tight tracking-tight text-neutral-900 md:px-5">
        {STEPS[step].comment}
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
        <p className="text-center text-[11px] text-neutral-500 sm:px-2">{atLast ? "End of sequence" : "Next advances the story"}</p>
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
