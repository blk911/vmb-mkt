"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  queueItemId: string;
  displayName: string;
  resolveEndpoint: string;
};

type ActionKind = "approve" | "merge" | "reject";

export default function ValidateDetailActions({ queueItemId, displayName, resolveEndpoint }: Props) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<ActionKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");

  async function logAction(action: ActionKind, result: "success" | "error", details?: Record<string, unknown>) {
    await fetch("/api/admin/pipeline/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: `validate_${action}`,
        entityType: "queue_item",
        entityId: queueItemId,
        result,
        details,
      }),
    }).catch(() => null);
  }

  async function handleAction(action: ActionKind) {
    setBusyAction(action);
    setError(null);

    try {
      const actionPayload =
        action === "approve"
          ? { action: "approved" }
          : action === "merge"
            ? { action: "merged", mergeTargetId: mergeTargetId.trim() }
            : { action: "rejected" };

      if (action === "merge" && !mergeTargetId.trim()) {
        setError("mergeTargetId_required");
        setBusyAction(null);
        return;
      }

      const response = await fetch(resolveEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actionPayload),
      });
      const data = await response.json().catch(() => ({ ok: false, error: "invalid_response" }));
      const ok = Boolean(response.ok && data?.ok);

      await logAction(action, ok ? "success" : "error", {
        displayName,
        endpoint: resolveEndpoint,
        actionPayload,
        error: ok ? undefined : data?.error || "request_failed",
      });

      const params = new URLSearchParams({
        status: ok ? "success" : "error",
        action,
        message: ok ? `${displayName} ${action === "approve" ? "approved" : action === "merge" ? "merged" : "rejected"} and removed from pending validation.` : String(data?.error || "request_failed"),
      });
      router.push(`/admin/validate?${params.toString()}`);
    } catch (caughtError: unknown) {
      const message = caughtError instanceof Error ? caughtError.message : "request_failed";
      setError(message);
      await logAction(action, "error", {
        displayName,
        endpoint: resolveEndpoint,
        error: message,
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <div className="mb-1 text-gray-600">Merge Target ID</div>
        <input
          className="w-full rounded border p-2"
          placeholder="Required only for Merge"
          type="text"
          value={mergeTargetId}
          onChange={(event) => setMergeTargetId(event.target.value)}
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={Boolean(busyAction)}
          onClick={() => handleAction("approve")}
          type="button"
        >
          {busyAction === "approve" ? "Working..." : "Approve"}
        </button>
        <button
          className="rounded bg-yellow-500 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={Boolean(busyAction)}
          onClick={() => handleAction("merge")}
          type="button"
        >
          {busyAction === "merge" ? "Working..." : "Merge"}
        </button>
        <button
          className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={Boolean(busyAction)}
          onClick={() => handleAction("reject")}
          type="button"
        >
          {busyAction === "reject" ? "Working..." : "Reject"}
        </button>
      </div>

      <p className="text-xs text-gray-500">Each button now sends an explicit final review outcome to the existing queue resolve endpoint.</p>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
