"use client";

import Link from "next/link";
import ValidateDetailActions from "@/components/admin/pipeline/ValidateDetailActions";
import { readable, type CatalogRecord } from "./catalog-ui-types";
import styles from "./CatalogWorkspace.module.css";

const TERMINAL_STATUSES = new Set(["approved", "merged", "rejected", "failed", "dismissed"]);
const PENDING_STATUSES = new Set(["queued", "resolved"]);

/** Legacy review keys are safe only when their original component IDs are unambiguous. */
export function hasSafeReviewIdentity(record: CatalogRecord) {
  const { intakeId, candidateId } = record.sourceIdentifiers || {};
  return record.entityType === "provider" && Boolean(intakeId && candidateId)
    && !/[:%]/.test(intakeId || "") && !/[:%]/.test(candidateId || "")
    && record.reviewKey === `${intakeId}::${candidateId}`
    && !record.conflicts?.includes("duplicate_candidate_source_key");
}

export function catalogReviewHref(record: CatalogRecord) {
  if (hasSafeReviewIdentity(record) && record.reviewLanes?.length) {
    const params = new URLSearchParams({ intakeId: record.sourceIdentifiers!.intakeId! });
    return `/admin/validate/${encodeURIComponent(record.reviewKey!)}?${params.toString()}`;
  }
  const intakeId = record.sourceIdentifiers?.intakeId;
  return `/admin/validate${intakeId ? `?${new URLSearchParams({ intakeId }).toString()}` : ""}`;
}

export function actionableReviewLane(lane: NonNullable<CatalogRecord["reviewLanes"]>[number]) {
  return lane.actionable === true && PENDING_STATUSES.has(lane.status) && !TERMINAL_STATUSES.has(lane.status)
    && (lane.lane === "DORA" || lane.lane === "SOCIAL")
    && Boolean(lane.queueItemId) && lane.queueItemId === lane.queueItemId.trim()
    && lane.queueItemId.length <= 512 && !/[/%\u0000-\u001f]/.test(lane.queueItemId);
}

export default function CatalogReviewActions({ record, canReview, onComplete, disabled = false }: {
  record: CatalogRecord; canReview: boolean; onComplete: () => void; disabled?: boolean;
}) {
  if (!canReview) return null;
  const lanes = record.reviewLanes || [];
  return <section className={styles.panel} aria-label="Review actions">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3>Review actions</h3>
      <Link href={catalogReviewHref(record)} className={styles.textButton} target="_blank" rel="noopener noreferrer">{hasSafeReviewIdentity(record) && lanes.length ? "Full review / merge" : "Open review queue"} ↗</Link>
    </div>
    <p className={styles.muted}>Each decision applies to its existing review lane. Approval is separate from DORA licensing evidence. Merging requires an explicit target in full review.</p>
    {lanes.length ? <div className="mt-3 grid gap-3 md:grid-cols-2">{lanes.map((lane, index) => <div key={`${lane.lane}:${lane.queueItemId}:${index}`} className="rounded-lg border border-gray-200 p-3">
      <p className="mb-3 text-sm font-medium">{lane.lane} · {readable(lane.status)}</p>
      {actionableReviewLane(lane) ? <ValidateDetailActions
        queueItemId={lane.queueItemId}
        displayName={`${record.displayName} (${lane.lane})`}
        resolveEndpoint={`/api/source-intake/${lane.lane === "DORA" ? "dora" : "social"}-queue/${encodeURIComponent(lane.queueItemId)}/resolve`}
        intakeId={record.sourceIdentifiers?.intakeId}
        allowMerge={false}
        disabled={disabled}
        onComplete={onComplete}
      /> : <p className={styles.muted}>{TERMINAL_STATUSES.has(lane.status) ? "This lane is already resolved and no longer accepts review actions here." : "Inline review is unavailable until this lane’s identity and state are unambiguous. Check the full review queue."}</p>}
    </div>)}</div> : <p className="mt-3 text-sm text-gray-600">No existing review queue is linked to this record. It can still be inspected and checked against DORA.</p>}
  </section>;
}
