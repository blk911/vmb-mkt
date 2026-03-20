import type { Cluster } from "@/lib/cluster/types";
import EvidenceBadges from "./evidence-badges";

export default function ClusterRow({
  cluster,
  isSelected,
  onSelect,
}: {
  cluster: Cluster;
  isSelected?: boolean;
  onSelect?: (cluster: Cluster) => void;
}) {
  const confirmedTechs = cluster.doraPeople.filter((x) => x.decision === "merged").length;
  const candidateTechs = cluster.doraPeople.filter((x) => x.decision === "candidate_only").length;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(cluster)}
      className={`w-full rounded-lg border p-3 text-left transition ${
        isSelected ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-neutral-900">{cluster.displayName}</div>
          <div className="mt-0.5 text-xs text-neutral-600">
            {cluster.headEntity.category || "unknown"} · {cluster.corridor || cluster.zone || "No zone"}
          </div>
          <div className="mt-0.5 truncate text-xs text-neutral-500">
            {cluster.displayAddress || cluster.headEntity.address || "Address unavailable"}
          </div>
          <EvidenceBadges cluster={cluster} />
        </div>

        <div className="shrink-0 text-right text-xs text-neutral-600">
          <div>Score {cluster.confidence}</div>
          <div>{confirmedTechs} techs</div>
          {candidateTechs > 0 ? <div>{candidateTechs} candidates</div> : null}
        </div>
      </div>
    </button>
  );
}
