"use client";

import { useCallback, useMemo, useState } from "react";
import ClientNetworkVisual from "@/components/marketing/ClientNetworkVisual";

type StepContent = {
  headline: string;
  subhead: string;
  anchor?: string;
  comment: string;
  microComment?: string;
};

const TOTAL_STEPS = 5;

const STEPS: StepContent[] = [
  {
    headline: "YOUR BUSINESS IS INDEPENDENT. YOUR CLIENTS ARE NETWORKED.",
    subhead: "Salons operate as standalone businesses — but clients move through a connected world of services.",
    anchor: "You don’t have a network. Add a network for brand and client leverage.",
    comment: "You have demand — VMB creates the network effect.",
  },
  {
    headline: "You’ve built strong relationships — now turn your clients’ networks into revenue.",
    subhead:
      "Your clients are connected — to friends, services, and providers — but that network isn’t generating for your business.",
    anchor: "You have the relationships. Now build the network.",
    comment: "Put your clients’ networks to work for you.",
  },
  {
    headline: "Your clients are already networked.",
    subhead: "They share, refer, and influence constantly — but it doesn’t flow through you.",
    anchor: "The network is active — you’re just not connected to it.",
    comment: "VMB opens the door.",
    microComment: "Tap into the network your clients already live in.",
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
  const rightBullets = [
    "Clients don’t stay in one place — they move across services",
    "Referrals happen — but you don’t capture them",
    "You don’t see where your clients go next",
    "Growth resets every time they leave",
  ] as const;
  return (
    <div className="relative w-full min-w-0 bg-white px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-start gap-8 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:gap-10">
        <div className="flex justify-center md:justify-end">
          <div className="w-full max-w-[17rem] rounded-2xl border border-neutral-200/90 bg-neutral-50/95 px-5 py-5 text-center shadow-sm">
            <p className="text-xl font-semibold text-neutral-900">Your Salon</p>
            <p className="mt-1 text-sm text-neutral-500">Strong brand. No network leverage.</p>
          </div>
        </div>
        <div className="relative flex flex-col gap-2 pt-1 md:pt-0">
          <ul className="space-y-3">
            {rightBullets.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-1 inline-flex h-4 w-4 shrink-0 rounded-full bg-blue-600" aria-hidden />
                <span className="text-base font-medium leading-snug text-neutral-700">{item}</span>
              </li>
            ))}
          </ul>
          <div className="pointer-events-none absolute -left-6 top-1/2 hidden h-px w-10 -translate-y-1/2 border-t border-dashed border-neutral-300 md:block" />
        </div>
      </div>
      <p className="mt-7 text-center text-lg font-semibold tracking-tight text-neutral-900 underline decoration-2 underline-offset-2">
        You don’t have a network. Add a network for brand and client leverage.
      </p>
    </div>
  );
}

function Slide7B() {
  const bullets = useMemo(
    () => [
      "Your clients move within trusted circles and shared services",
      "Referrals happen — but they don’t flow back to you",
      "Clients connect across providers — without your involvement",
      "The network exists — but it doesn’t generate for your business",
    ],
    [],
  );
  return (
    <div className="relative w-full min-w-0 bg-white px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-start gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10">
        <div className="relative min-h-[260px] rounded-2xl border border-neutral-200/90 bg-neutral-50/95 p-5 shadow-sm">
          <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-neutral-800 px-6 py-4 text-center shadow-md">
            <p className="text-lg font-semibold text-white">Your Salon</p>
            <p className="mt-1 text-xs text-neutral-300">Strong relationships</p>
          </div>

          <div className="absolute left-[16%] top-[20%] rounded-full border border-neutral-200/90 bg-white px-3 py-1 text-xs font-medium text-neutral-700 shadow-sm">
            Client A
          </div>
          <div className="absolute right-[14%] top-[22%] rounded-full border border-neutral-200/90 bg-white px-3 py-1 text-xs font-medium text-neutral-700 shadow-sm">
            Client B
          </div>
          <div className="absolute left-[18%] bottom-[18%] rounded-full border border-neutral-200/90 bg-white px-3 py-1 text-xs font-medium text-neutral-700 shadow-sm">
            Client C
          </div>
          <div className="absolute right-[16%] bottom-[20%] rounded-full border border-neutral-200/90 bg-white px-3 py-1 text-xs font-medium text-neutral-700 shadow-sm">
            Client D
          </div>

          <div className="pointer-events-none absolute left-[30%] top-[32%] h-px w-24 rotate-[20deg] border-t border-neutral-400/80" />
          <div className="pointer-events-none absolute right-[30%] top-[33%] h-px w-24 -rotate-[20deg] border-t border-neutral-400/80" />
          <div className="pointer-events-none absolute left-[30%] bottom-[33%] h-px w-24 -rotate-[20deg] border-t border-neutral-400/80" />
          <div className="pointer-events-none absolute right-[30%] bottom-[34%] h-px w-24 rotate-[20deg] border-t border-neutral-400/80" />
        </div>

        <div className="space-y-3">
          {bullets.map((item) => (
            <div key={item} className="flex items-start gap-2.5">
              <span className="mt-1 inline-flex h-4 w-4 shrink-0 rounded-full bg-blue-600" aria-hidden />
              <p className="max-w-[36rem] text-base font-medium leading-snug text-neutral-700">{item}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-7 text-center text-lg font-semibold tracking-tight text-neutral-900 underline decoration-2 underline-offset-2">
        You have the relationships. Now build the network.
      </p>
      <p className="mt-2 text-center text-sm font-medium text-neutral-500">Put your clients’ networks to work for you.</p>
    </div>
  );
}

function Slide7C() {
  const bullets = [
    "Clients talk, share, and recommend within trusted circles",
    "Decisions are influenced long before a booking happens",
    "Services are discovered through friends, not platforms",
    "That network drives behavior — but you don’t see or capture it",
  ] as const;
  return (
    <div className="relative w-full min-w-0 bg-white px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <ClientNetworkVisual />

        <div className="space-y-3">
          {bullets.map((item) => (
            <div key={item} className="flex items-start gap-2.5">
              <span className="mt-1 inline-flex h-4 w-4 shrink-0 rounded-full bg-blue-600" aria-hidden />
              <p className="max-w-[46rem] text-base font-medium leading-snug text-neutral-700">{item}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-6 text-center text-lg font-semibold tracking-tight text-neutral-900 underline decoration-2 underline-offset-2">
        The network is active — you’re just not connected to it.
      </p>
      <p className="mt-2 text-center text-sm font-medium text-neutral-500">VMB opens the door.</p>
      <p className="mt-1 text-center text-xs font-medium text-neutral-400">Tap into the network your clients already live in.</p>
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
        <div className="space-y-3">
          {bullets.map((item) => (
            <div key={item} className="flex items-start gap-2.5">
              <span className="mt-1 inline-flex h-4 w-4 shrink-0 rounded-full bg-blue-600" aria-hidden />
              <p className="max-w-[36rem] text-base font-medium leading-snug text-neutral-700">{item}</p>
            </div>
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
        <div className="sm:px-2" />
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
