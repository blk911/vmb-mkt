"use client";

type Props = {
  /** v1 surfaced operators are always high-confidence. */
  confidence?: "high";
};

export default function OperatorConfidenceBadge({ confidence = "high" }: Props) {
  return (
    <span className="inline-flex shrink-0 rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900">
      {confidence === "high" ? "High" : confidence}
    </span>
  );
}
