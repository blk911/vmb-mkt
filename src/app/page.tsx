"use client";

import Link from "next/link";
import { useState } from "react";
import VmbThirtySecondsContent from "@/components/marketing/VmbThirtySecondsContent";

const RIGHT_SIDE_QA_SECTIONS = [
  {
    title: null,
    items: [
      {
        question: "How is this different from booking apps?",
        answer: "They manage appointments. VMB creates them.",
      },
      {
        question: "Where do the clients come from?",
        answer: "From your existing audience - activated through trust.",
      },
      {
        question: "Why does this work?",
        answer: "People choose based on trust - not ads.",
      },
    ],
  },
  {
    title: "Trust + Network",
    items: [
      {
        question: "What is an invite-only client network?",
        answer: "A private group of clients connected through trust, not traffic.",
      },
      {
        question: "Why does invite-only matter?",
        answer: "It filters out noise and attracts higher-intent clients.",
      },
      {
        question: "Are these random clients?",
        answer: "No - they come through people who already trust you.",
      },
      {
        question: "What kind of clients does VMB attract?",
        answer: "Clients who value the service, not just the price.",
      },
    ],
  },
  {
    title: "Revenue + Behavior",
    items: [
      {
        question: "Do clients actually show up?",
        answer: "Yes - they come in prepaid and committed.",
      },
      {
        question: "Will this reduce cancellations?",
        answer: "Yes - prepaid, trust-based clients follow through.",
      },
      {
        question: "Do clients come back?",
        answer: "Yes - and they bring others with them.",
      },
      {
        question: "Does this increase client value?",
        answer: "Yes - better clients, better spend, better retention.",
      },
    ],
  },
  {
    title: "Marketing Shift",
    items: [
      {
        question: "Do I need to run ads?",
        answer: "No - VMB replaces ad spend with client-driven growth.",
      },
      {
        question: "Do I need to post more?",
        answer: "No - it works with the attention you already have.",
      },
      {
        question: "Do I need to change my pricing?",
        answer: "No - VMB works with your current services.",
      },
    ],
  },
  {
    title: "System + Ease",
    items: [
      {
        question: "Is this hard to set up?",
        answer: "No - you just turn it on.",
      },
      {
        question: "Does it change how I run my salon?",
        answer: "No - it runs on top of what you already do.",
      },
      {
        question: "Do I need new software?",
        answer: "No - VMB integrates with your current workflow.",
      },
    ],
  },
  {
    title: "Positioning",
    items: [
      {
        question: "Is this marketing?",
        answer: "No - it is a conversion engine.",
      },
      {
        question: "What am I really building with VMB?",
        answer: "Your own client network that grows your business.",
      },
      {
        question: "What is the real advantage?",
        answer: "You stop chasing clients - and start owning them.",
      },
    ],
  },
] as const;

export default function Home() {
  const [showVmbThirtySeconds, setShowVmbThirtySeconds] = useState(false);

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <section className="mx-auto min-h-[calc(100vh-56px)] max-w-6xl px-4 py-12">
        <div className="mb-8 text-center text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
          EMPOWERING | PERSONAL | CONNECTION
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm md:p-10">
            <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              External Access
            </span>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-950 md:text-4xl">
              Welcome to VMB Salons
            </h1>
            <p className="mt-4 text-2xl font-semibold leading-8 text-neutral-900 md:text-3xl">
              You Get Attention. We Turn It Into Cash.
            </p>
            <div className="mt-6 max-w-3xl space-y-4 text-base leading-7 text-neutral-700 md:text-lg">
              <p>
                You&apos;re already getting views. Likes. DMs.
                <br />
                Most of it goes nowhere.
              </p>
              <p>
                VMB sits on top of your social and converts that attention into trusted clients - who show up
                prepaid and become part of your exclusive client network.
              </p>
              <p>Not followers - your client marketing team.</p>
            </div>

            <div className="mt-8 space-y-2 text-base leading-7 text-neutral-800 md:text-lg">
              <p>VMB converts your social media into a client network that drives real revenue.</p>
              <p>Clients show up prepaid, love the experience, and bring others with them.</p>
              <p>No ads. No monthly fees. Just turn it on and let it work.</p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/access/request"
                onClick={() => setShowVmbThirtySeconds(false)}
                className="inline-flex items-center justify-center rounded-xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Activate VMB
              </Link>
              <button
                type="button"
                onClick={() => setShowVmbThirtySeconds((prev) => !prev)}
                aria-pressed={showVmbThirtySeconds}
                className={`inline-flex items-center justify-center rounded-xl border px-5 py-3 text-sm font-semibold transition ${
                  showVmbThirtySeconds
                    ? "border-sky-400 bg-sky-50 text-sky-800"
                    : "border-neutral-300 text-neutral-900 hover:border-neutral-400 hover:bg-neutral-50"
                }`}
              >
                See VMB in 30 Seconds
              </button>
              <Link
                href="/access/request"
                onClick={() => setShowVmbThirtySeconds(false)}
                className="inline-flex items-center justify-center rounded-xl border border-neutral-300 px-5 py-3 text-sm font-semibold text-neutral-900 transition hover:border-neutral-400 hover:bg-neutral-50"
              >
                Request Access
              </Link>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <Link
                href="/access/request"
                onClick={() => setShowVmbThirtySeconds(false)}
                className="block rounded-2xl border border-neutral-200 bg-neutral-50 p-5 transition hover:border-neutral-300 hover:bg-white"
              >
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-900">venmebaby.com</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-700">
                  Runs the engine - access, control, and operations.
                </p>
              </Link>
              <a
                href="https://www.vmbsalons.com"
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-neutral-200 bg-neutral-50 p-5 transition hover:border-neutral-300 hover:bg-white"
              >
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-900">vmbsalons.com</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-700">
                  Drives the business - converts attention into trusted, paying clients.
                </p>
              </a>
            </div>

            {showVmbThirtySeconds ? (
              <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-900">VMB in 30 Seconds</p>
                <div className="mt-4 text-sm leading-relaxed text-neutral-600 md:text-base">
                  <VmbThirtySecondsContent showEmailButton />
                </div>
              </div>
            ) : null}
          </div>

          <aside className="rounded-3xl border border-neutral-200 bg-neutral-950 p-8 text-white shadow-sm md:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">What VMB Does for You</p>
            <div className="mt-6 space-y-4 text-sm leading-6 text-neutral-300 md:text-base">
              <p>Turn your social attention into real revenue</p>
              <p>Get prepaid clients who actually show up</p>
              <p>Build a client network that grows your business</p>
              <p>Increase repeat visits and higher-value clients</p>
              <p>Run it all with no ads and no monthly fees</p>
            </div>

            <div className="mt-8 space-y-8">
              {RIGHT_SIDE_QA_SECTIONS.map((section, index) => (
                <div key={section.title ?? `section-${index}`} className="space-y-4">
                  {section.title ? (
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">{section.title}</p>
                  ) : null}
                  {section.items.map((item) => (
                    <div key={item.question} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                      <p className="text-lg font-semibold text-white">{item.question}</p>
                      <p className="mt-2 text-sm leading-6 text-neutral-300 md:text-base">{item.answer}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
