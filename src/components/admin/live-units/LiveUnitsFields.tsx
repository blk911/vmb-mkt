"use client";

import * as React from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function FilterGrid({
  children,
  cols = "3",
}: {
  children: React.ReactNode;
  cols?: "2" | "3" | "4";
}) {
  const map = {
    "2": "grid-cols-1 md:grid-cols-2",
    "3": "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
    "4": "grid-cols-1 md:grid-cols-2 xl:grid-cols-4",
  };

  return <div className={cx("grid gap-4", map[cols])}>{children}</div>;
}

export function FilterField({
  label,
  children,
  width = "md",
}: {
  label: string;
  children: React.ReactNode;
  width?: "sm" | "md" | "lg" | "full";
}) {
  const widthMap = {
    sm: "max-w-[140px]",
    md: "max-w-[260px]",
    lg: "max-w-[320px]",
    full: "max-w-none",
  };

  return (
    <div className={cx("min-w-0", widthMap[width])}>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

export function PillButton({
  children,
  active = false,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex h-9 items-center rounded-full border px-3 text-sm font-medium transition",
        active
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

export function ActionButton({
  children,
  tone = "default",
  onClick,
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
  onClick?: () => void;
}) {
  const toneMap = {
    default: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    warning: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
    danger: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex h-9 items-center rounded-full border px-3 text-sm font-medium transition",
        toneMap[tone]
      )}
    >
      {children}
    </button>
  );
}
