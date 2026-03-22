import type { ResolverRecommendation } from "@/lib/unknown-resolver/resolver-types";

type Props = { recommendation: ResolverRecommendation; label?: string; className?: string };

export default function ResolverRecommendationBadge({ recommendation, label, className = "" }: Props) {
  const text = label ?? recommendation.toUpperCase();
  const styles =
    recommendation === "yes"
      ? "bg-emerald-100 text-emerald-900 border-emerald-400"
      : recommendation === "review"
        ? "bg-amber-100 text-amber-900 border-amber-400"
        : "bg-neutral-200 text-neutral-800 border-neutral-400";

  return (
    <span
      className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles} ${className}`}
    >
      {text}
    </span>
  );
}
