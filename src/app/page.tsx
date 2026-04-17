"use client";

import Link from "next/link";
import { useState } from "react";

export default function Home() {
  const [showVmbThirtySeconds, setShowVmbThirtySeconds] = useState(false);

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <section className="mx-auto min-h-[calc(100vh-56px)] max-w-5xl px-4 py-12">
        <div className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm md:p-10">
          <div>
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
                See How It Works
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
                <div className="mt-4 space-y-3 text-base leading-7 text-neutral-800">
                  <p>Turn your existing social attention into real revenue</p>
                  <p>Clients show up prepaid - fewer cancellations</p>
                  <p>Clients return, bring others, and grow your network</p>
                  <p>Build your own invite-only client base</p>
                  <p>No ads. No monthly fees. No disruption</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
