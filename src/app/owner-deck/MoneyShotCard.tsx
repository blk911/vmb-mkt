"use client";

import { useState } from "react";

const BULLETS = [
  "NEW BOOKINGS ARE PAID IN ADVANCE",
  "REGISTER NEW WALK/CALL-INS TO VEN ME BABY!",
  "PRIORITIZE LOYAL VMB CLIENT BOOKINGS",
  "CLIENT INCENTIVES REPLACE AD SPEND",
  "REFERRALS BECOME VMB CLIENTS",
  "GIFT REQUEST FROM CLIENT SIGNIFICANT OTHER = BIG!",
  "OWNER SHARE THE VMB CONCEPT WITH OWNERS",
  "CO-MARKETING IS A RECURRING INCOME STREAM",
  "VMB MEMBERS BENEFIT AS VMB ADDS HAIR, BROW, SPAS, AND MORE...",
];

export default function MoneyShotCard() {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<"SALON" | "CLIENT">("SALON");

  function openModal(from: "SALON" | "CLIENT") {
    setSource(from);
    setOpen(true);
  }

  return (
    <section className="w-full">
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-3xl border border-white/10 bg-neutral-950 p-7 shadow-sm md:p-10">
          <div className="mb-2 text-center text-xs font-semibold tracking-widest text-white/60">THINK DIV CARD</div>
          <h3 className="text-center text-3xl font-semibold tracking-tight text-white md:text-4xl">MONEY SHOT</h3>
          <div className="mt-6 flex w-full gap-4">
            <button
              type="button"
              onClick={() => openModal("SALON")}
              className="relative flex-1 rounded-2xl border border-white/20 bg-white/10 px-6 py-4 text-center text-xl font-semibold tracking-wide text-white hover:bg-white/20 md:text-2xl"
            >
              <span>SALON</span>
            </button>
            <button
              type="button"
              onClick={() => openModal("CLIENT")}
              className="relative flex-1 rounded-2xl border border-white/20 bg-white px-6 py-4 text-center text-xl font-semibold tracking-wide text-neutral-900 hover:bg-neutral-100 md:text-2xl"
            >
              <span>CLIENT</span>
            </button>
          </div>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[56rem] rounded-2xl bg-white p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold tracking-widest text-neutral-500">{source}</div>
                <h4 className="mt-1 text-2xl font-semibold text-neutral-900 md:text-3xl">SALON + VMB = MONEY SHOT</h4>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-neutral-300 px-3 py-1 text-base font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Close
              </button>
            </div>
            <ul className="mt-5 space-y-2 text-base leading-relaxed text-neutral-800 md:text-lg">
              {BULLETS.map((item, idx) => (
                <li key={item} className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 items-start gap-3">
                    <span aria-hidden className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-neutral-700" />
                    <span className={idx === BULLETS.length - 1 ? "md:whitespace-nowrap" : ""}>{item}</span>
                  </span>
                  <span aria-hidden className="flex-none text-xl leading-none">
                    💵
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
