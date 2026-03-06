"use client";

import { useState } from "react";
import SalonCashFlowComparison from "@/components/marketing/SalonCashFlowComparison";

const CARDS = [
  "#1 VMB's Mission Statement",
  "#2 The VMB Game Plan",
  "#3 VMB Co-Marketing Program",
  "#4 What's Next...",
  "#5 FAQ",
];

export default function DetailsCards() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  function toggle(idx: number) {
    setOpenIdx((prev) => (prev === idx ? null : idx));
  }

  return (
    <div className="mx-auto mt-8 max-w-5xl space-y-4 px-4 pb-16">
      {CARDS.map((title, idx) => {
        const open = openIdx === idx;
        return (
          <div key={title} className="rounded-2xl border bg-white shadow-sm">
            <button
              type="button"
              onClick={() => toggle(idx)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <span className="text-lg font-semibold text-neutral-900 md:text-xl">{title}</span>
              <span className="text-sm font-medium text-neutral-500">{open ? "Close" : "Open"}</span>
            </button>
            {open ? (
              <div className="border-t px-5 py-4 text-sm leading-relaxed text-neutral-600 md:text-base">
                {idx === 2 ? (
                  <SalonCashFlowComparison />
                ) : (
                  <>Lorem ipsum content slot. Click card header again to close.</>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
