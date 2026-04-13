import type { ImportDecisionStatus } from "@/lib/import-diff/types";

const STYLES: Record<ImportDecisionStatus, string> = {
  unresolved: "bg-neutral-100 text-neutral-700",
  standalone: "bg-emerald-100 text-emerald-800",
  likely_duplicate: "bg-amber-100 text-amber-800",
  merge_candidate: "bg-sky-100 text-sky-800",
};

export function DecisionStatusBadge({ status }: { status: ImportDecisionStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[status]}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
