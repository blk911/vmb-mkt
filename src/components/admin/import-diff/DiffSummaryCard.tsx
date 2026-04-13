import type { DiffSummary } from "@/lib/import-diff/types";

const STATUS_LABELS: Record<DiffSummary["fieldChanges"][number]["status"], string> = {
  same: "same",
  different: "different",
  missing_imported: "missing on import",
  missing_target: "missing on target",
};

export function DiffSummaryCard({ diffSummary }: { diffSummary: DiffSummary | null }) {
  if (!diffSummary) {
    return (
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Diff Summary</h2>
        <p className="mt-2 text-sm text-neutral-500">No diff summary available because no likely merge target was found.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-neutral-900">Diff Summary</h2>
        <p className="text-sm text-neutral-600">
          {diffSummary.importedEntityLabel}
          {diffSummary.targetEntityLabel ? ` vs ${diffSummary.targetEntityLabel}` : ""}
        </p>
      </div>

      {diffSummary.warnings.length ? (
        <div className="mb-4 grid gap-2">
          {diffSummary.warnings.map((warning) => (
            <div key={warning} className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {warning}
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3">
        {diffSummary.fieldChanges.map((field) => (
          <div key={field.field} className="grid gap-2 rounded-xl bg-neutral-50 p-3 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_140px]">
            <div className="font-medium text-neutral-700">{field.field}</div>
            <div className="break-all text-sm text-neutral-700">{String(field.importedValue ?? "-")}</div>
            <div className="break-all text-sm text-neutral-700">{String(field.targetValue ?? "-")}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{STATUS_LABELS[field.status]}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
