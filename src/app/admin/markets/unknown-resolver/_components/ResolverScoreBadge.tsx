type Props = { score: number; className?: string };

export default function ResolverScoreBadge({ score, className = "" }: Props) {
  const tier =
    score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  const styles =
    tier === "high"
      ? "bg-emerald-100 text-emerald-900 border-emerald-300"
      : tier === "medium"
        ? "bg-amber-100 text-amber-900 border-amber-300"
        : "bg-neutral-200 text-neutral-800 border-neutral-400";

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums ${styles} ${className}`}
      title="System score (0–100)"
    >
      {score}
    </span>
  );
}
