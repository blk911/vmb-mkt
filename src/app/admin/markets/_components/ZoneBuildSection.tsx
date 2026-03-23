"use client";

import type { ReactNode } from "react";

type Props = {
  title: string;
  count: number;
  children: ReactNode;
};

export default function ZoneBuildSection({ title, count, children }: Props) {
  return (
    <div className="mt-3 rounded-lg border border-neutral-200/90 bg-white/90 px-3 py-2.5 shadow-sm">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">{title}</h3>
        <span className="tabular-nums text-[10px] font-semibold text-neutral-500">{count}</span>
      </div>
      {children}
    </div>
  );
}
