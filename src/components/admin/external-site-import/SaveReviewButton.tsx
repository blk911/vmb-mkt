"use client";

import { useEffect, useState } from "react";
import type { ImportedProfileDraft } from "@/lib/external-site-import/types";
import type { ImportedProfileReviewPayload } from "@/lib/external-site-review/types";

type SaveReviewButtonProps = {
  draftId: string;
  review: ImportedProfileReviewPayload;
  disabled?: boolean;
  onSaved?: (draft: ImportedProfileDraft) => void;
};

type SaveReviewResponse = {
  ok: boolean;
  error?: string;
  draft?: ImportedProfileDraft;
};

export function SaveReviewButton({ draftId, review, disabled, onSaved }: SaveReviewButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setStatus(null);
  }, [draftId]);

  async function handleSave() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(`/api/external-site-import/${encodeURIComponent(draftId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review }),
      });
      const json = (await response.json()) as SaveReviewResponse;
      if (!response.ok || !json.ok || !json.draft) {
        throw new Error(json.error || "Review save failed");
      }
      setStatus(`Review saved: ${json.draft.id}`);
      onSaved?.(json.draft);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Review save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={disabled || busy}
        className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Saving Review..." : "Save Review"}
      </button>
      {error ? <div className="text-sm text-rose-700">{error}</div> : null}
      {status ? <div className="text-sm text-emerald-700">{status}</div> : null}
    </div>
  );
}
