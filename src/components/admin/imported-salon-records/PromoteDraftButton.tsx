"use client";

import Link from "next/link";
import { useState } from "react";
import type { ImportedSalonRecord } from "@/lib/imported-salon-records/types";

type PromoteDraftButtonProps = {
  draftId: string;
  disabled?: boolean;
  compact?: boolean;
  onPromoted?: (record: ImportedSalonRecord) => void;
};

type PromoteResponse = {
  ok: boolean;
  error?: string;
  record?: ImportedSalonRecord;
};

export function PromoteDraftButton({ draftId, disabled, compact, onPromoted }: PromoteDraftButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);

  async function handlePromote() {
    setBusy(true);
    setError(null);
    setRecordId(null);
    try {
      const response = await fetch(`/api/external-site-import/${encodeURIComponent(draftId)}/promote`, {
        method: "POST",
      });
      const json = (await response.json()) as PromoteResponse;
      if (!response.ok || !json.ok || !json.record) {
        throw new Error(json.error || "Promotion failed");
      }
      setRecordId(json.record.id);
      onPromoted?.(json.record);
    } catch (promoteError: unknown) {
      setError(promoteError instanceof Error ? promoteError.message : "Promotion failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "grid gap-1" : "grid gap-2"}>
      <button
        type="button"
        onClick={() => void handlePromote()}
        disabled={disabled || busy}
        className="rounded-lg border border-sky-300 px-3 py-1.5 text-xs font-medium text-sky-800 disabled:opacity-60"
      >
        {busy ? "Promoting..." : "Promote"}
      </button>
      {error ? <div className="text-xs text-rose-700">{error}</div> : null}
      {recordId ? (
        <div className="text-xs text-emerald-700">
          Created `{recordId}`.{" "}
          <Link href="/admin/source-intake/imported-salon-records" className="underline">
            Open promoted records
          </Link>
        </div>
      ) : null}
    </div>
  );
}
