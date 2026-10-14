"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DoraEvidence from "@/components/admin/pipeline/DoraEvidence";
import { compactText } from "@/components/admin/pipeline/CompactProfile";

import ProfileRefinementControls from "@/components/admin/pipeline/ProfileRefinementControls";
import { toRefinementQueueItem } from "@/lib/admin/pipeline/profile-presentation";
import BookingPlatformLinks, { CatalogContactLinks } from "./BookingPlatformLinks";
import CatalogEvidenceDetails from "./CatalogEvidenceDetails";
import { readJson, type CatalogRecord } from "./catalog-ui-types";
import CatalogReviewActions, { hasSafeReviewIdentity } from "./CatalogReviewActions";
import styles from "./CatalogWorkspace.module.css";

export default function CatalogDetail({ record, onClose, onRefreshed, onSelectForList }: { record: CatalogRecord; onClose: () => void; admin?: boolean; onRefreshed?: () => void; onSelectForList?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  // Route-level props are hints only. The latest authenticated detail response
  // must grant the capability before any mutation controls are rendered.
  const [snapshot, setSnapshot] = useState({ record, canReview: false, attempt: -1 });
  const [failure, setFailure] = useState<{ id: string; attempt: number; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const detail = snapshot.record.id === record.id ? snapshot.record : record;
  const error = failure?.id === record.id && failure.attempt === attempt ? failure.message : "";
  const loading = !error && (snapshot.record.id !== record.id || snapshot.attempt !== attempt);
  const canReview = !loading && !error && snapshot.record.id === record.id && snapshot.canReview;
  const refinementRows = useMemo(() => detail.reviewKey && hasSafeReviewIdentity(detail)
    ? [toRefinementQueueItem({ reviewKey: detail.reviewKey, profile: detail.profile })] : [], [detail]);
  const [checkedAt] = useState(() => new Date().toISOString());
  const refreshDetail = useCallback(() => { setAttempt((value) => value + 1); onRefreshed?.(); }, [onRefreshed]);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    readJson<{ record: CatalogRecord; viewer?: { canReview?: boolean } }>(`/api/catalog?id=${encodeURIComponent(record.id)}`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          if (data.record.id !== record.id) throw new Error("The returned record did not match this request.");
          setSnapshot({ record: data.record, canReview: data.viewer?.canReview === true, attempt });
          setFailure(null);
        }
      })
      .catch((failure: Error) => { if (!controller.signal.aborted) setFailure({ id: record.id, attempt, message: failure.message }); });
    return () => controller.abort();
  }, [record.id, attempt]);

  const name = compactText(detail.entityType === "business" ? detail.businessName || detail.displayName : detail.providerName || detail.displayName);
  const businessName = compactText(detail.businessName);
  const salon = detail.entityType !== "business" && businessName !== "Unkwn" && businessName.toLocaleLowerCase() !== name.toLocaleLowerCase() ? businessName : "";
  const location = [[detail.city, detail.state].filter(Boolean).join(", "), detail.postalCode].filter(Boolean).join(" ");
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="catalog-detail-title" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.detailHeader}>
      <div><span className={styles.recordKind}>{detail.entityType === "business" ? "Business / location" : "Provider"}</span><h2 id="catalog-detail-title">{name}</h2>
        {salon ? <p className={styles.salonName}>{salon}</p> : null}<p>{location || "Location Unkwn"}</p></div>
      <button type="button" className={styles.button} onClick={onClose} autoFocus>Close</button>
    </div>
    <div className={styles.detailBody}>
      <div className={styles.quickLinks} aria-label="Booking and social links"><BookingPlatformLinks profile={detail.profile} />
        <CatalogContactLinks profile={detail.profile} hideEmpty />
      </div>
      {loading ? <p className={styles.muted} role="status">Loading latest details…</p> : null}
      {error ? <div className={styles.error} role="alert">Latest details could not be loaded: {error} <button className={styles.textButton} onClick={() => setAttempt((value) => value + 1)}>Retry</button></div> : null}
      <DoraEvidence key={detail.id} compact dora={detail.dora} catalogId={detail.id} admin={canReview} onUpdated={refreshDetail} />
      {onSelectForList ? <div className={styles.profileActions}><button type="button" className={styles.button} disabled={loading || !!error} onClick={onSelectForList}>Add to list…</button><span className={styles.muted}>Notes and next actions stay with your saved list.</span></div> : null}
      <details className={styles.advancedEvidence}>
        <summary>Evidence &amp; review{detail.conflicts?.length ? <span className={styles.conflictLabel}> · {detail.conflicts.length} source differences</span> : null}</summary>
        <div className={styles.advancedActions}>
          {canReview && refinementRows.length ? <ProfileRefinementControls rows={refinementRows} scope={`catalog:${detail.reviewKey}`} checkedAt={checkedAt} automatic={false} buttonLabel="Refine" onComplete={refreshDetail} /> : null}
          <CatalogReviewActions record={detail} canReview={snapshot.record.id === record.id && snapshot.canReview} disabled={!canReview} onComplete={refreshDetail} />
        </div>
        <CatalogEvidenceDetails record={detail} />
      </details>
    </div>
  </dialog>;
}
