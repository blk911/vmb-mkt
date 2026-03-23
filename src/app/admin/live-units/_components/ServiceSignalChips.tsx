"use client";

import type { ServiceSignal } from "@/lib/live-units/service-signal-types";
import { serviceSignalLabel } from "@/lib/live-units/service-signal-logic";

const TONE: Record<ServiceSignal, string> = {
  nails: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900",
  hair: "border-amber-200 bg-amber-50 text-amber-950",
  esthetics: "border-sky-200 bg-sky-50 text-sky-950",
  spa: "border-emerald-200 bg-emerald-50 text-emerald-950",
};

type Props = {
  signals: ServiceSignal[];
  className?: string;
};

/** Compact per-row service chips (max ~4). */
export default function ServiceSignalChips({ signals, className = "" }: Props) {
  if (signals.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {signals.map((s) => (
        <span
          key={s}
          className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none border ${TONE[s]}`}
        >
          {serviceSignalLabel(s)}
        </span>
      ))}
    </div>
  );
}
