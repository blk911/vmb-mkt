"use client";

import { useRef, useState } from "react";
import { WORKFLOW_STAGES, WORKFLOW_DISPOSITIONS, normalizeTargetWorkflow } from "@/lib/ops/targetWorkflow";
import type { WorkflowStage, WorkflowDisposition } from "@/lib/ops/targetWorkflow";
import { dateLabel, postList, type CatalogList } from "./catalog-ui-types";
import styles from "./CatalogWorkspace.module.css";

function localDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function ListEditor({ list, onUpdated, onClose, onSaveStart, onSaveEnd }: { list: CatalogList; onUpdated: (list: CatalogList) => void; onClose: () => void; onSaveStart: () => boolean; onSaveEnd: () => void }) {
  const [name, setName] = useState(list.name);
  const [notes, setNotes] = useState(list.notes || "");
  const [workflow, setWorkflow] = useState(() => ({ ...normalizeTargetWorkflow(list.workflow), nextAction: list.workflow?.nextAction || "", nextActionAt: localDateTime(list.workflow?.nextActionAt) }));
  const saving = useRef(false);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function save(op: string, data: Record<string, unknown>, label: string) {
    if (saving.current || !onSaveStart()) return;
    saving.current = true;
    setPending(op); setError(""); setNotice("");
    try {
      const result = await postList({ op, id: list.id, ...data });
      if (!result.list) throw new Error("The server did not return the saved list. Refresh to verify.");
      onUpdated(result.list);
      setNotice(`${label} saved.`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Save failed. Please retry."); }
    finally { saving.current = false; setPending(""); onSaveEnd(); }
  }

  return <section className={`${styles.panel} ${styles.listEditor}`} aria-label="List settings">
    <div className={styles.listHeading}><h2>List settings</h2><button className={styles.textButton} type="button" disabled={!!pending} onClick={onClose}>Done</button></div>
    <div className={styles.editorBody}>
      {error ? <div role="alert" className={styles.error}>{error}</div> : null}
      {notice ? <p role="status" className={styles.success}>{notice}</p> : null}
      <form className={styles.inlineForm} onSubmit={(event) => { event.preventDefault(); void save("rename", { name: name.trim() }, "Name"); }}>
        <label className={styles.field}><span>List name</span><input required value={name} onChange={(event) => setName(event.target.value)} /></label>
        <button className={styles.button} disabled={!!pending || !name.trim()}>{pending === "rename" ? "Saving…" : "Save name"}</button>
      </form>
      <form onSubmit={(event) => { event.preventDefault(); void save("setNotes", { notes }, "Notes"); }}>
        <label className={styles.field}><span>Notes</span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Context, qualification notes, or follow-up plan" /></label>
        <button className={styles.button} disabled={!!pending}>{pending === "setNotes" ? "Saving…" : "Save notes"}</button>
      </form>
      <form onSubmit={(event) => { event.preventDefault(); void save("setWorkflow", { workflow: { ...workflow, nextActionAt: workflow.nextActionAt ? new Date(workflow.nextActionAt).toISOString() : "" } }, "Workflow"); }}>
        <div className={styles.filterGrid}>
          <label className={styles.field}><span>Owner</span><input value={workflow.owner} onChange={(event) => setWorkflow({ ...workflow, owner: event.target.value })} placeholder="Unassigned" /></label>
          <label className={styles.field}><span>Stage</span><select value={workflow.stage} onChange={(event) => setWorkflow({ ...workflow, stage: event.target.value as WorkflowStage })}>{WORKFLOW_STAGES.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
          <label className={styles.field}><span>Disposition</span><select value={workflow.disposition} onChange={(event) => setWorkflow({ ...workflow, disposition: event.target.value as WorkflowDisposition })}>{WORKFLOW_DISPOSITIONS.map((disposition) => <option key={disposition}>{disposition}</option>)}</select></label>
          <label className={styles.field}><span>Next action due (local time)</span><input type="datetime-local" value={workflow.nextActionAt} onChange={(event) => setWorkflow({ ...workflow, nextActionAt: event.target.value })} /></label>
          <label className={`${styles.field} ${styles.wideField}`}><span>Next action</span><input value={workflow.nextAction} onChange={(event) => setWorkflow({ ...workflow, nextAction: event.target.value })} placeholder="What should happen next?" /></label>
        </div>
        <div className={styles.editorActions}><label className={styles.checkLabel}><input type="checkbox" checked={workflow.pinned} onChange={(event) => setWorkflow({ ...workflow, pinned: event.target.checked })} /> Pin this list</label><button className={styles.button} disabled={!!pending}>{pending === "setWorkflow" ? "Saving…" : "Save workflow"}</button></div>
      </form>
      <p className={styles.muted}>Last saved: {dateLabel(list.updatedAt)}. These fields organize work; they do not send messages or start campaigns.</p>
    </div>
  </section>;
}
