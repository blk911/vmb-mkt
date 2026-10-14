"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  queueItemId: string;
  displayName: string;
  resolveEndpoint: string;
  intakeId?: string;
  /** Inline callers refresh their current record instead of navigating away. */
  onComplete?: () => void;
  allowMerge?: boolean;
  disabled?: boolean;
};

type ActionKind = "approve" | "merge" | "reject";

export default function ValidateDetailActions({ queueItemId, displayName, resolveEndpoint, intakeId, onComplete, allowMerge = true, disabled = false }: Props) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<ActionKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [confirmation, setConfirmation] = useState<"merge" | "reject" | null>(null);
  const [completed, setCompleted] = useState("");
  const active = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function logAction(action: ActionKind, result: "success" | "error", details?: Record<string, unknown>) {
    await fetch("/api/admin/pipeline/log", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: `validate_${action}`, entityType: "queue_item", entityId: queueItemId, result, details }),
    }).catch(() => null);
  }

  async function handleAction(action: ActionKind) {
    if (active.current || disabled || completed || (action === "merge" && !allowMerge)) return;
    if (action === "merge" && !mergeTargetId.trim()) {
      setError("Enter the exact target ID before merging.");
      return;
    }
    active.current = true;
    setBusyAction(action);
    setConfirmation(null);
    setError(null);
    const actionPayload = action === "approve" ? { action: "approved" }
      : action === "merge" ? { action: "merged", mergeTargetId: mergeTargetId.trim() } : { action: "rejected" };

    try {
      const response = await fetch(resolveEndpoint, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actionPayload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true) throw new Error(data?.message || data?.error || `Request failed (${response.status}).`);
      void logAction(action, "success", { displayName, endpoint: resolveEndpoint, actionPayload });
      if (!mounted.current) return;
      const message = `${displayName} ${action === "approve" ? "approved" : action === "merge" ? "merged" : "rejected"} and removed from pending review.`;
      setCompleted(message);
      if (onComplete) onComplete();
      else {
        const params = new URLSearchParams({ status: "success", action, message });
        if (intakeId) params.set("intakeId", intakeId);
        router.push(`/admin/validate?${params.toString()}`);
      }
    } catch (caughtError: unknown) {
      const message = caughtError instanceof Error ? caughtError.message : "Request failed. Please retry.";
      if (mounted.current) setError(message.replaceAll("_", " "));
      void logAction(action, "error", { displayName, endpoint: resolveEndpoint, error: message });
    } finally {
      active.current = false;
      if (mounted.current) setBusyAction(null);
    }
  }

  function requestAction(action: ActionKind) {
    if (active.current || disabled || completed) return;
    setError(null);
    if (action === "approve") { void handleAction(action); return; }
    if (action === "merge" && (!allowMerge || !mergeTargetId.trim())) {
      setError("Enter the exact target ID before merging.");
      return;
    }
    setConfirmation(action);
  }

  const unavailable = disabled || Boolean(busyAction) || Boolean(completed);
  return (
    <div className="space-y-3" aria-busy={Boolean(busyAction)}>
      {allowMerge ? <label className="block text-sm">
        <div className="mb-1 text-gray-600">Merge Target ID</div>
        <input className="w-full rounded border p-2" placeholder="Required only for Merge" type="text"
          disabled={unavailable || Boolean(confirmation)} value={mergeTargetId} onChange={(event) => setMergeTargetId(event.target.value)} />
      </label> : null}
      <div className="flex flex-wrap gap-3">
        <button className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={unavailable || Boolean(confirmation)} onClick={() => requestAction("approve")} type="button">{busyAction === "approve" ? "Working…" : "Approve"}</button>
        {allowMerge ? <button className="rounded bg-yellow-500 px-4 py-2 text-sm font-medium text-gray-950 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={unavailable || Boolean(confirmation)} onClick={() => requestAction("merge")} type="button">{busyAction === "merge" ? "Working…" : "Merge"}</button> : null}
        <button className="rounded bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={unavailable || Boolean(confirmation)} onClick={() => requestAction("reject")} type="button">{busyAction === "reject" ? "Working…" : "Reject"}</button>
      </div>
      {confirmation ? <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm" role="group" aria-label="Confirm review decision">
        <p>{confirmation === "merge" ? `Merge ${displayName} into target ${mergeTargetId.trim()}?` : `Reject ${displayName}?`} This resolves this review lane and removes it from pending review. Original source evidence is retained.</p>
        <div className="mt-3 flex gap-3">
          <button type="button" className="rounded border bg-white px-3 py-1.5" disabled={unavailable} onClick={() => void handleAction(confirmation)}>Confirm {confirmation === "merge" ? "merge" : "rejection"}</button>
          <button type="button" className="rounded border bg-white px-3 py-1.5" disabled={Boolean(busyAction)} onClick={() => setConfirmation(null)}>Cancel</button>
        </div>
      </div> : null}
      {completed ? <p className="text-sm text-green-800" role="status">{completed}</p> : null}
      {error ? <p className="text-sm text-red-700" role="alert">Review was not confirmed: {error} Refresh the record to check its current state before retrying.</p> : null}
    </div>
  );
}
