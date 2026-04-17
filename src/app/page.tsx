"use client";

import Link from "next/link";
import { useState } from "react";
import VmbThirtySecondsContent from "@/components/marketing/VmbThirtySecondsContent";

export default function Home() {
  const [showVmbThirtySeconds, setShowVmbThirtySeconds] = useState(false);

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <section className="mx-auto min-h-[calc(100vh-56px)] max-w-6xl px-4 py-12">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm md:p-10">
            <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              External Access
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-neutral-950 md:text-5xl">
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

            <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
              <div className="space-y-2 text-base leading-7 text-neutral-800">
                <p>VMB converts your social media into a client network that drives real revenue.</p>
                <p>Clients show up prepaid, love the experience, and bring others with them.</p>
                <p>No ads. No monthly fees. Just turn it on and let it work.</p>
              </div>
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
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-900">venmebaby.com</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-700">
                  Runs the engine - access, control, and operations.
                </p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-900">vmbsalons.com</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-700">
                  Drives the business - converts attention into trusted, paying clients.
                </p>
              </div>
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

            <div className="mt-8 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-sky-300">Micro Q</p>
                <p className="mt-2 text-lg font-semibold text-white">Do I need to change how I work?</p>
                <p className="mt-2 text-sm leading-6 text-neutral-300 md:text-base">
                  No - VMB runs on top of what you already do.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-sky-300">Micro Q</p>
                <p className="mt-2 text-lg font-semibold text-white">Do I need to market differently?</p>
                <p className="mt-2 text-sm leading-6 text-neutral-300 md:text-base">
                  No - VMB converts the attention you&apos;re already getting.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
