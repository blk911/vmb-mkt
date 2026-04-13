"use client";

import { useState } from "react";
import type { ImportDecisionStatus } from "@/lib/import-diff/types";

type SetDecisionStatusButtonsProps = {
  endpoint: string;
  currentStatus: ImportDecisionStatus;
  onUpdated?: (entity: unknown) => void;
};

export function SetDecisionStatusButtons({ endpoint, currentStatus, onUpdated }: SetDecisionStatusButtonsProps) {
  const [busyStatus, setBusyStatus] = useState<ImportDecisionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleUpdate(nextStatus: ImportDecisionStatus) {
    setBusyStatus(nextStatus);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionStatus: nextStatus }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string; draft?: unknown; record?: unknown };
      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Decision status update failed");
      }
      onUpdated?.(json.draft ?? json.record);
      setStatus(`Decision set to ${nextStatus}.`);
    } catch (updateError: unknown) {
      setError(updateError instanceof Error ? updateError.message : "Decision status update failed");
    } finally {
      setBusyStatus(null);
    }
  }

  const buttons: Array<{ label: string; value: ImportDecisionStatus }> = [
    { label: "Mark Standalone", value: "standalone" },
    { label: "Mark Likely Duplicate", value: "likely_duplicate" },
    { label: "Mark Merge Candidate", value: "merge_candidate" },
    { label: "Reset to Unresolved", value: "unresolved" },
  ];

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {buttons.map((button) => (
          <button
            key={button.value}
            type="button"
            onClick={() => void handleUpdate(button.value)}
            disabled={busyStatus !== null || currentStatus === button.value}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-800 disabled:opacity-60"
          >
            {busyStatus === button.value ? "Saving..." : button.label}
          </button>
        ))}
      </div>
      {error ? <div className="text-sm text-rose-700">{error}</div> : null}
      {status ? <div className="text-sm text-emerald-700">{status}</div> : null}
    </div>
  );
}
