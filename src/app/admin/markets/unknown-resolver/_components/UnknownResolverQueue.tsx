import type { PromoteToOutreachInput } from "@/lib/unknown-resolver/resolver-storage";
import type { EnrichedResolverRow, ResolverDecision } from "@/lib/unknown-resolver/resolver-types";
import UnknownResolverQueueCard from "./UnknownResolverQueueCard";

type Props = {
  rows: EnrichedResolverRow[];
  onUpdateDecision: (recordId: string, decision: ResolverDecision, note: string | null) => void;
  onPromoteToOutreach: (recordId: string, input: PromoteToOutreachInput) => void;
};

export default function UnknownResolverQueue({ rows, onUpdateDecision, onPromoteToOutreach }: Props) {
  if (!rows.length) {
    return <p className="rounded border border-dashed border-neutral-300 bg-neutral-50 px-3 py-6 text-center text-sm text-neutral-600">No records match filters.</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <UnknownResolverQueueCard
          key={row.record.id}
          row={row}
          onUpdateDecision={onUpdateDecision}
          onPromoteToOutreach={onPromoteToOutreach}
        />
      ))}
    </div>
  );
}
