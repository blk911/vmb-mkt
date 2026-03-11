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
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-2xl border border-slate-200 bg-white shadow-sm",
        className
      )}
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {title}
        </h3>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function MetricTile({ label, value, tone = "default" }: MetricCard) {
  return (
    <div
      className={cx(
        "min-h-[74px] rounded-xl border px-3 py-3 shadow-sm",
        metricTone(tone)
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-75">
        {label}
      </div>
      <div className="mt-1 text-[28px] font-semibold leading-none tracking-tight">
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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(760px,1fr)_340px]">
        <div className="space-y-5">
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

          {primaryFilters ? (
            <SectionCard title="Review Filters">{primaryFilters}</SectionCard>
          ) : null}

          <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
            {categoryFilters ? (
              <SectionCard title="Category / Signal">{categoryFilters}</SectionCard>
            ) : null}

            {geographyFilters ? (
              <SectionCard title="Geography / Score">{geographyFilters}</SectionCard>
            ) : null}
          </div>
        </div>

        <aside className="space-y-4">
          <SectionCard title="Queue Snapshot">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
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

      <div className="mt-6">
        <SectionCard title="Results">{results}</SectionCard>
      </div>
    </div>
  );
}
