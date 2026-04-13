import type { ImportedSalonRecordStatus } from "@/lib/imported-salon-records/types";

const STYLES: Record<ImportedSalonRecordStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  archived: "bg-neutral-100 text-neutral-700",
};

export function SalonRecordStatusBadge({ status }: { status: ImportedSalonRecordStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[status]}`}>
      {status}
    </span>
  );
}
