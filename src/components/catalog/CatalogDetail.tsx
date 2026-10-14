"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DoraEvidence from "@/components/admin/pipeline/DoraEvidence";
import { CompactPlatform, CompactValue } from "@/components/admin/pipeline/CompactProfile";
import ProfileRefinementControls from "@/components/admin/pipeline/ProfileRefinementControls";
import { toRefinementQueueItem } from "@/lib/admin/pipeline/profile-presentation";
import { ProfileSummaryCard, SourceLink } from "@/components/admin/pipeline/ProfileEvidence";
import { dateLabel, readable, readJson, type CatalogRecord } from "./catalog-ui-types";
import styles from "./CatalogWorkspace.module.css";

export default function CatalogDetail({ record, onClose, admin = false, onRefreshed }: { record: CatalogRecord; onClose: () => void; admin?: boolean; onRefreshed?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState(record);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const refreshDetail = useCallback(() => { setLoading(true); setAttempt((value) => value + 1); onRefreshed?.(); }, [onRefreshed]);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    readJson<{ record: CatalogRecord }>(`/api/catalog?id=${encodeURIComponent(record.id)}`, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) { setDetail(data.record); setError(""); } })
      .catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
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
      {error ? <div className={styles.error} role="alert">Latest details could not be loaded: {error} <button className={styles.textButton} onClick={() => { setLoading(true); setAttempt((value) => value + 1); }}>Retry</button></div> : null}
      <div className={styles.recordSummary}>
        <div><span>Review status</span><strong>{readable(detail.reviewStatus)}</strong></div>
        <div><span>Services</span><strong><CompactValue value={detail.services.join(", ")} /></strong></div>
        <div><span>Area · City / ZIP</span><strong><CompactValue value={[detail.area, detail.city, detail.state, detail.postalCode].filter(Boolean).join(" · ")} /></strong></div>
        <div><span>Updated</span><strong>{dateLabel(detail.updatedAt)}</strong></div>
      </div>
      {detail.conflicts?.length ? <section className={styles.warning}><h3>Unresolved differences</h3><ul>{detail.conflicts.map((conflict, index) => <li key={index}>{conflict}</li>)}</ul></section> : null}
      {admin && detail.reviewKey ? <ProfileRefinementControls rows={[toRefinementQueueItem({ reviewKey: detail.reviewKey, profile: detail.profile })]} scope={`catalog:${detail.reviewKey}`} checkedAt={new Date().toISOString()} automatic={false} onComplete={refreshDetail} /> : null}
      <DoraEvidence key={detail.id} dora={detail.dora} catalogId={detail.id} admin={admin} onUpdated={refreshDetail} />
      <ProfileSummaryCard profile={detail.profile} />
      <section className={styles.panel}>
        <h3>Linked entities</h3>
        <p className={styles.muted}>Relationships retain their source or review basis. A shared location does not establish a person’s identity.</p>
        {detail.linkedEntities?.length ? <ul className={styles.evidenceList}>{detail.linkedEntities.map((entity, index) => <li key={`${entity.id}:${index}`}><strong>{entity.label || entity.id}</strong><span>{readable(entity.entityType)} · {readable(entity.relationship)} · {readable(entity.basis)}</span><small>{entity.id}</small></li>)}</ul> : <p className={styles.muted}>No linked entities recorded.</p>}
      </section>
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
