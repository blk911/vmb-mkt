"use client";

import { useCallback, useState } from "react";
import type { ResolverDecision } from "@/lib/unknown-resolver/resolver-types";

type Props = {
  recordId: string;
  initialNote: string | null;
  initialDecision: ResolverDecision | null;
  onSave: (recordId: string, decision: ResolverDecision, note: string | null) => void;
  disabled?: boolean;
};

export default function ResolverOperatorActions({
  recordId,
  initialNote,
  initialDecision,
  onSave,
  disabled = false,
}: Props) {
  const [decision, setDecision] = useState<ResolverDecision | null>(initialDecision);
  const [note, setNote] = useState(initialNote ?? "");

  const save = useCallback(() => {
    if (decision == null) return;
    onSave(recordId, decision, note.trim() || null);
  }, [decision, note, onSave, recordId]);

  const btn = "rounded border px-2 py-1 text-[11px] font-semibold transition disabled:opacity-50";
  const active = "border-neutral-900 bg-neutral-900 text-white";
  const idle = "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50";

  return (
    <div className="space-y-2 border-t border-neutral-200 pt-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Operator decision</div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" disabled={disabled} className={`${btn} ${decision === "yes" ? active : idle}`} onClick={() => setDecision("yes")}>
          Yes
        </button>
        <button
          type="button"
          disabled={disabled}
          className={`${btn} ${decision === "review" ? active : idle}`}
          onClick={() => setDecision("review")}
        >
          Review
        </button>
        <button type="button" disabled={disabled} className={`${btn} ${decision === "no" ? active : idle}`} onClick={() => setDecision("no")}>
          No
        </button>
      </div>
      <label className="block">
        <span className="text-[10px] font-semibold text-neutral-500">Note</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={disabled}
          rows={2}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-800 outline-none focus:border-neutral-500"
          placeholder="Optional context for outreach…"
        />
      </label>
      <button
        type="button"
        disabled={disabled || decision == null}
        onClick={save}
        className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Save decision
      </button>
    </div>
  );
}
