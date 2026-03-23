"use client";

type Props = {
  isMultiService: boolean;
};

/** Single-line single vs multi-service indicator. */
export default function MultiServiceBadge({ isMultiService }: Props) {
  return (
    <span
      className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        isMultiService ? "bg-violet-100 text-violet-900 border border-violet-200" : "bg-slate-100 text-slate-600 border border-slate-200"
      }`}
      title={isMultiService ? "Multiple service signals detected" : "Single primary service signal"}
    >
      {isMultiService ? "Multi" : "Single"}
    </span>
  );
}
