"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DoraEvidence from "@/components/admin/pipeline/DoraEvidence";
import { CompactPlatform, CompactValue } from "@/components/admin/pipeline/CompactProfile";
import ProfileRefinementControls from "@/components/admin/pipeline/ProfileRefinementControls";
import { toRefinementQueueItem } from "@/lib/admin/pipeline/profile-presentation";
import { ProfileSummaryCard, SourceLink } from "@/components/admin/pipeline/ProfileEvidence";
import { dateLabel, readable, readJson, type CatalogRecord } from "./catalog-ui-types";
import CatalogReviewActions, { hasSafeReviewIdentity } from "./CatalogReviewActions";
import styles from "./CatalogWorkspace.module.css";

export default function CatalogDetail({ record, onClose, onRefreshed }: { record: CatalogRecord; onClose: () => void; admin?: boolean; onRefreshed?: () => void }) {
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

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="catalog-detail-title" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.detailHeader}>
      <div><div className={styles.eyebrow}><CompactPlatform profile={detail.profile} /></div><h2 id="catalog-detail-title">{detail.displayName}</h2>
        <p>{detail.entityType === "business" ? "Business / location record · Not an individual provider" : "Provider record · Identity claims remain source-attributed"}</p></div>
      <button type="button" className={styles.button} onClick={onClose} autoFocus>Close</button>
    </div>
    <div className={styles.detailBody}>
      {loading ? <p role="status">Loading the latest linked evidence…</p> : null}
      {error ? <div className={styles.error} role="alert">Latest details could not be loaded: {error} <button className={styles.textButton} onClick={() => setAttempt((value) => value + 1)}>Retry</button></div> : null}
      <div className={styles.recordSummary}>
        <div><span>Review status</span><strong>{readable(detail.reviewStatus)}</strong></div>
        <div><span>Market</span><strong><CompactValue value={detail.market} /></strong></div>
        <div><span>Vertical</span><strong><CompactValue value={detail.vertical} /></strong></div>
        <div><span>Services</span><strong><CompactValue value={detail.services.join(", ")} /></strong></div>
        <div><span>Area · City / ZIP</span><strong><CompactValue value={[detail.area, detail.city, detail.state, detail.postalCode].filter(Boolean).join(" · ")} /></strong></div>
        <div><span>Updated</span><strong>{dateLabel(detail.updatedAt)}</strong></div>
      </div>
      {detail.conflicts?.length ? <section className={styles.warning}><h3>Unresolved differences</h3><ul>{detail.conflicts.map((conflict, index) => <li key={index}>{conflict}</li>)}</ul></section> : null}
      {canReview && refinementRows.length ? <ProfileRefinementControls rows={refinementRows} scope={`catalog:${detail.reviewKey}`} checkedAt={checkedAt} automatic={false} buttonLabel="Refine" onComplete={refreshDetail} /> : null}
      <CatalogReviewActions record={detail} canReview={snapshot.record.id === record.id && snapshot.canReview} disabled={!canReview} onComplete={refreshDetail} />
      <DoraEvidence key={detail.id} dora={detail.dora} catalogId={detail.id} admin={canReview} onUpdated={refreshDetail} />
      <ProfileSummaryCard profile={detail.profile} />
      <section className={styles.panel}>
        <h3>Linked entities</h3>
        <p className={styles.muted}>Relationships retain their source or review basis. A shared location does not establish a person’s identity.</p>
        {detail.linkedEntities?.length ? <ul className={styles.evidenceList}>{detail.linkedEntities.map((entity, index) => <li key={`${entity.id}:${index}`}><strong>{entity.label || entity.id}</strong><span>{readable(entity.entityType)} · {readable(entity.relationship)} · {readable(entity.basis)}</span><small>{entity.id}</small></li>)}</ul> : <p className={styles.muted}>No linked entities recorded.</p>}
      </section>
      {detail.mapping ? <section className={styles.panel}>
        <h3>Market and vertical provenance</h3>
        <p className={styles.muted}>These fields use attributable source evidence. A city alone does not establish a market.</p>
        {(["market", "vertical"] as const).map((field) => <details key={field} className={styles.sourceRefs}>
          <summary>{field === "market" ? "Market" : "Vertical"} · {readable(detail.mapping![field].status)}</summary>
          {detail.mapping![field].reason ? <p>{readable(detail.mapping![field].reason)}</p> : null}
          <ul className={styles.evidenceList}>{detail.mapping![field].evidence.map((evidence, index) => <li key={`${evidence.sourceRef.collection}:${evidence.sourceRef.id}:${evidence.sourceField}:${index}`}>
            <strong>{evidence.value}</strong><span>{readable(evidence.basis)} · {evidence.sourceField}</span>
            <small>{evidence.sourceRef.collection} · {evidence.sourceRef.id}</small>
            {evidence.sourceUrl ? <SourceLink url={evidence.sourceUrl} label="Open mapping source" /> : null}
          </li>)}</ul>
        </details>)}
      </section> : null}
      <section className={styles.panel}>
        <h3>Source evidence</h3>
        {detail.factClaims?.length ? <details className={styles.sourceRefs}><summary>Stored fact claims ({detail.factClaims.length})</summary><ul className={styles.evidenceList}>{detail.factClaims.map((fact) => <li key={fact.id}><strong>{readable(fact.kind)}</strong><span className="break-all">{fact.value}</span><small>{readable(fact.attribution)} · {readable(fact.status)} · {fact.sourceField}</small>{fact.sourceUrl ? <SourceLink url={fact.sourceUrl} label="Open fact source" /> : null}</li>)}</ul></details> : null}
        {detail.evidence?.length ? <ul className={styles.evidenceList}>{detail.evidence.map((evidence, index) => <li key={`${evidence.id}:${index}`}><strong>{evidence.label || readable(evidence.kind)}</strong><span>{readable(evidence.kind)} · {dateLabel(evidence.observedAt)}</span>{evidence.sourceUrl ? <SourceLink url={evidence.sourceUrl} label="Open exact source" /> : <span className={styles.muted}>No source URL recorded</span>}</li>)}</ul> : <p className={styles.muted}>No additional source evidence recorded.</p>}
        {detail.sourceRefs.length ? <details className={styles.sourceRefs}><summary>Source references ({detail.sourceRefs.length})</summary><ul>{detail.sourceRefs.map((source, index) => <li key={`${source.collection}:${source.id}:${index}`}>{readable(source.role)} · {source.collection} · {source.id}</li>)}</ul></details> : null}
      </section>
      <section className={styles.panel}>
        <h3>Review decisions</h3>
        {detail.reviewDecisions?.length ? <ul className={styles.evidenceList}>{detail.reviewDecisions.map((decision, index) => <li key={`${decision.id}:${index}`}><strong>{readable(decision.lane)} · {readable(decision.status)}</strong><span>{dateLabel(decision.reviewedAt)}{decision.reviewedBy ? ` · ${decision.reviewedBy}` : ""}</span>{decision.targetId ? <small>Linked target: {decision.targetId}</small> : null}</li>)}</ul> : <p className={styles.muted}>No review decisions recorded. Catalog inclusion is not approval.</p>}
      </section>
    </div>
  </dialog>;
}
