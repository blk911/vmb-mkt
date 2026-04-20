"use client";

import { useMemo, useState } from "react";
import NextActionLink from "@/components/admin/pipeline/NextActionLink";
import type { BuildSourceType, BuildSubmissionResult } from "@/lib/admin/pipeline/types";

const SOURCES: BuildSourceType[] = ["Instagram", "DORA", "Upload", "URL"];

function placeholderForSource(sourceType: BuildSourceType | null): string {
  if (sourceType === "Instagram") return "Paste Instagram hashtag harvest text here.";
  if (sourceType === "DORA") return 'Paste a JSON array, {"records":[...]}, or simple CSV/TSV export.';
  if (sourceType === "Upload") return 'Paste a JSON array, {"records":[...]}, CSV/TSV export, or one name per line.';
  if (sourceType === "URL") return "Paste one website URL per line.";
  return "";
}

export default function BuildPage() {
  const [sourceType, setSourceType] = useState<BuildSourceType | null>(null);
  const [rawText, setRawText] = useState("");
  const [result, setResult] = useState<BuildSubmissionResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const textareaPlaceholder = useMemo(() => placeholderForSource(sourceType), [sourceType]);

  async function logBuildAction(payload: {
    sourceType: BuildSourceType;
    result: string;
    endpoint?: string;
    details?: Record<string, unknown>;
  }) {
    await fetch("/api/admin/pipeline/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "build_submit",
        entityType: "build_source",
        entityId: payload.sourceType,
        result: payload.result,
        details: {
          endpoint: payload.endpoint,
          ...payload.details,
        },
      }),
    }).catch(() => null);
  }

  async function handleSubmit() {
    if (!sourceType) return;
    if (!rawText.trim()) {
      setResult({ ok: false, error: "raw_input_required" });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/pipeline/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType, rawText }),
      });
      const normalized = (await response.json().catch(() => ({ ok: false, error: "invalid_response" }))) as BuildSubmissionResult;
      setResult(normalized);

      await logBuildAction({
        sourceType,
        endpoint: normalized.ok ? normalized.endpoint : "/api/admin/pipeline/intake",
        result: normalized.ok ? "success" : "error",
        details: normalized.ok
          ? {
              recordsReceived: normalized.summary.recordsReceived,
              evidenceAdded: normalized.summary.evidenceAdded,
              operatorsCreated: normalized.summary.operatorsCreated,
              notes: normalized.summary.notes,
            }
          : { error: normalized.error },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "request_failed";
      setResult({ ok: false, error: message });
      await logBuildAction({
        sourceType,
        result: "error",
        details: { error: message },
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Build Supply</h1>
        <p className="mt-1 text-sm text-gray-600">This step uses the unified admin intake adapter and guarantees validation queue work on success.</p>
      </div>

      <div>
        <h2 className="font-semibold">1. Select Source</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {SOURCES.map((source) => (
            <button
              key={source}
              onClick={() => setSourceType(source)}
              className={`rounded px-3 py-2 text-sm ${
                sourceType === source ? "bg-black text-white" : "bg-gray-200 text-gray-900"
              }`}
              type="button"
            >
              {source}
            </button>
          ))}
        </div>
      </div>

      {sourceType ? (
        <div className="space-y-3">
          <div>
            <h2 className="font-semibold">2. Input Data</h2>
            <p className="mt-1 text-sm text-gray-600">The payload is normalized once, routed through the canonical intake path, then queued for validation.</p>
          </div>

          <textarea
            className="h-48 w-full rounded border bg-white p-3"
            placeholder={textareaPlaceholder}
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
          />

          <button
            className="rounded bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? "Submitting..." : "Parse + Send to Validation"}
          </button>
        </div>
      ) : null}

      {result ? (
        <div className={`rounded-xl border p-4 ${result.ok ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          <h2 className="font-semibold">{result.ok ? "Submission Summary" : "Submission Failed"}</h2>
          {result.ok ? (
            <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
              <SummaryStat label="Records Received" value={result.summary.recordsReceived} />
              <SummaryStat label="Evidence Added" value={result.summary.evidenceAdded} />
              <SummaryStat label="Operators Created" value={result.summary.operatorsCreated} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-red-700">{result.error}</p>
          )}
          {result.ok && result.summary.notes?.length ? (
            <div className="mt-3 text-sm text-gray-700">
              {result.summary.notes.map((note) => (
                <div key={note}>{note}</div>
              ))}
            </div>
          ) : null}
          {result.ok ? <p className="mt-3 text-sm font-medium text-green-800">Next: review the new pending item in Validate.</p> : null}
        </div>
      ) : null}

      <NextActionLink href="/admin/validate" text="Review pending operators in Validate" />
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white p-3 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
