"use client";

import * as React from "react";

type MetricCard = {
  label: string;
  value: number | string;
  tone?: "default" | "success" | "warning" | "danger" | "muted";
};

type LiveUnitsShellProps = {
  title?: string;
  subtitle?: string;
  badges?: React.ReactNode;
  metrics: MetricCard[];
  quickViews?: React.ReactNode;
  bulkActions?: React.ReactNode;
  primaryFilters?: React.ReactNode;
  categoryFilters?: React.ReactNode;
  geographyFilters?: React.ReactNode;
  results: React.ReactNode;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function metricTone(tone: MetricCard["tone"]) {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "danger":
      return "border-rose-200 bg-rose-50 text-rose-900";
    case "muted":
      return "border-zinc-200 bg-zinc-50 text-zinc-700";
    default:
      return "border-slate-200 bg-white text-slate-900";
  }
}

function SectionCard({
  title,
  children,
  className,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className={cx(
        "group rounded-2xl border border-slate-200 bg-white shadow-sm",
        className
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {title}
        </h3>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 transition group-open:rotate-180">
          Open
        </span>
      </summary>
      <div className="p-4">{children}</div>
    </details>
  );
}

function MetricTile({ label, value, tone = "default" }: MetricCard) {
  return (
    <div
      className={cx(
        "w-[16ch] rounded-xl border px-2.5 py-2 shadow-sm",
        metricTone(tone)
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-75">
        {label}
      </div>
      <div className="mt-1 text-[22px] font-semibold leading-none tracking-tight">
        {value}
      </div>
    </div>
  );
}

export default function LiveUnitsShell({
  title = "Live Units",
  subtitle = "Review queue for combined Google, DORA, and online identity signals.",
  badges,
  metrics,
  quickViews,
  bulkActions,
  primaryFilters,
  categoryFilters,
  geographyFilters,
  results,
}: LiveUnitsShellProps) {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 pb-8 pt-5 md:px-6">
      <div className="mb-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              {title}
            </h1>
            <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            {badges ? <div className="mt-3 flex flex-wrap gap-2">{badges}</div> : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(860px,1fr)_16ch]">
        <div className="space-y-4">
          {(quickViews || bulkActions) && (
            <SectionCard title="Queue Controls">
              <div className="space-y-4">
                {quickViews ? (
                  <div>
                    <div className="mb-2 text-xs font-medium text-slate-500">
                      Quick Views
                    </div>
                    <div className="flex flex-wrap gap-2">{quickViews}</div>
                  </div>
                ) : null}

                {bulkActions ? (
                  <div>
                    <div className="mb-2 text-xs font-medium text-slate-500">
                      Bulk Actions
                    </div>
                    <div className="flex flex-wrap gap-2">{bulkActions}</div>
                  </div>
                ) : null}
              </div>
            </SectionCard>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {primaryFilters ? (
              <SectionCard title="Review Filters">{primaryFilters}</SectionCard>
            ) : null}

            {categoryFilters ? (
              <SectionCard title="Category / Signal">{categoryFilters}</SectionCard>
            ) : null}

            {geographyFilters ? (
              <SectionCard title="Geography / Score">{geographyFilters}</SectionCard>
            ) : null}
          </div>
        </div>

        <aside className="space-y-3 xl:justify-self-end">
          <SectionCard title="Queue Snapshot">
            <div className="flex flex-col gap-2">
              {metrics.map((metric) => (
                <MetricTile
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  tone={metric.tone}
                />
              ))}
            </div>
          </SectionCard>
        </aside>
      </div>

      <div className="mt-5">
        <SectionCard title="Results">{results}</SectionCard>
      </div>
    </div>
  );
}
