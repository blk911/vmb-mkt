"use client";

import type { PlatformSignalsRecord, PlatformType } from "@/lib/live-units/platform-signal-types";

const PLATFORM_LABEL: Record<PlatformType, string> = {
  fresha: "Fresha",
  vagaro: "Vagaro",
  booksy: "Booksy",
  glossgenius: "GlossGenius",
};

type Props = {
  platformSignals?: PlatformSignalsRecord | null;
  className?: string;
};

/** Compact bookable + platform chips aligned with ServiceSignalChips styling. */
export default function PlatformSignalBadges({ platformSignals, className = "" }: Props) {
  if (!platformSignals) return null;
  const entries = (Object.entries(platformSignals) as [PlatformType, { isBookable?: boolean }][]).filter(
    ([, v]) => v && v.isBookable
  );
  if (entries.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`} title="Booking platform signals (high-confidence match)">
      <span className="inline-flex rounded border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-teal-900">
        Bookable
      </span>
      {entries.map(([platform]) => (
        <span
          key={platform}
          className="inline-flex rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-violet-900"
        >
          {PLATFORM_LABEL[platform]}
        </span>
      ))}
    </div>
  );
}
