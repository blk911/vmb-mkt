import type { ImportedProfileDraftStatus } from "@/lib/external-site-import/types";

const STYLES: Record<ImportedProfileDraftStatus, string> = {
  draft: "bg-neutral-100 text-neutral-700",
  reviewed: "bg-amber-100 text-amber-800",
  ready: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
};

export function DraftStatusBadge({ status }: { status: ImportedProfileDraftStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[status]}`}>
      {status}
    </span>
  );
}
