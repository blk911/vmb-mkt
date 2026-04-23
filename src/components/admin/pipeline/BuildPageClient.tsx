"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import NextActionLink from "@/components/admin/pipeline/NextActionLink";
import type { BuildSourceType, BuildSubmissionResult } from "@/lib/admin/pipeline/types";

const SOURCES: BuildSourceType[] = ["Instagram", "DORA", "Upload", "URL"];
const BUILD_DRAFT_STORAGE_KEY = "vmb.admin.buildDraft.v1";

const SOURCE_LABELS: Record<BuildSourceType, string> = {
  Instagram: "Instagram Text",
  DORA: "DORA Records",
  Upload: "Bulk Upload",
  URL: "Single URL",
};

const SOURCE_GUIDANCE: Record<
  BuildSourceType,
  {
    whatToPaste: string;
    whatNotToPaste: string;
    example: string;
    nextStep: string;
  }
> = {
  Instagram: {
    whatToPaste: "Copied Instagram captions, hashtag results, or copied profile/post text blocks.",
    whatNotToPaste: "Booking links or generic website URLs.",
    example: "@denvernailartist\nDenver Nail Artist\nCaption text with tagged techs and service hints",
    nextStep: "The system parses Instagram text into candidates, preserves IG context, and queues matching validation lanes.",
  },
  DORA: {
    whatToPaste: "Copied license, facility, or business record text from DORA exports or record views.",
    whatNotToPaste: "Social captions or website URLs.",
    example: "Business Name, License Number, City, State",
    nextStep: "The system normalizes the records, creates canonical candidates, and queues them for validation.",
  },
  Upload: {
    whatToPaste: "CSV rows, structured JSON, TSV, or other batch-formatted records.",
    whatNotToPaste: "Single URLs or one-off Instagram text blocks.",
    example: 'name,city,website\nLafayette Nails,Lafayette,https://example.com',
    nextStep: "The system adapts the batch rows into canonical candidate records and queues validation work.",
  },
  URL: {
    whatToPaste: "One clean business, profile, booking, or location page URL.",
    whatNotToPaste: "Instagram hashtag/search/explore links or bulk text blocks.",
    example: "https://book.solasalonstudios.com/lafayette/location",
    nextStep: "The system normalizes the URL once, derives any supported identity hints, and queues validation from that canonical URL.",
  },
};

type PersistedBuildDraft = {
  sourceType: BuildSourceType | null;
  rawText: string;
  updatedAt: string;
};

function placeholderForSource(sourceType: BuildSourceType | null): string {
  if (sourceType === "Instagram") return "Paste copied Instagram text blocks here.";
  if (sourceType === "DORA") return 'Paste copied DORA records, JSON, or CSV/TSV export here.';
  if (sourceType === "Upload") return 'Paste CSV, TSV, JSON, or other structured batch rows here.';
  if (sourceType === "URL") return "Paste one clean business/profile/booking/location URL here.";
  return "";
}

function isBuildSourceType(value: unknown): value is BuildSourceType {
  return value === "Instagram" || value === "DORA" || value === "Upload" || value === "URL";
}

function toNonEmptyLines(rawText: string): string[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isSinglePlainUrl(rawText: string): boolean {
  const lines = toNonEmptyLines(rawText);
  return lines.length === 1 && /^https?:\/\/\S+$/i.test(lines[0]);
}

function looksLikeInstagramSearchOrExploreUrl(rawText: string): boolean {
  if (!isSinglePlainUrl(rawText)) return false;
  try {
    const url = new URL(toNonEmptyLines(rawText)[0]);
    const hostname = url.hostname.toLowerCase();
    if (hostname !== "instagram.com" && hostname !== "www.instagram.com") return false;
    return /\/(explore|search)\b/i.test(url.pathname);
  } catch {
    return false;
  }
}

function buildSourceWarnings(sourceType: BuildSourceType | null, rawText: string): string[] {
  if (!sourceType) return [];
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  if (sourceType === "URL" && looksLikeInstagramSearchOrExploreUrl(rawText)) {
    return ["This looks like an Instagram search or explore URL. Use Instagram Text for copied hashtag/search results, not Single URL."];
  }

  if (sourceType === "Instagram" && isSinglePlainUrl(rawText)) {
    return ["This looks like a booking or website URL. Use Single URL instead of Instagram Text for direct links."];
  }

  if (sourceType === "Upload" && isSinglePlainUrl(rawText)) {
    return ["This looks like one plain URL. Use Single URL instead of Bulk Upload for one-off links."];
  }

  return [];
}

function readPersistedDraft(): PersistedBuildDraft | null {
  try {
    const raw = window.localStorage.getItem(BUILD_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedBuildDraft>;
    return {
      sourceType: isBuildSourceType(parsed.sourceType) ? parsed.sourceType : null,
      rawText: typeof parsed.rawText === "string" ? parsed.rawText : "",
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return null;
  }
}

export default function BuildPageClient() {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<BuildSourceType | null>(null);
  const [rawText, setRawText] = useState("");
  const [result, setResult] = useState<BuildSubmissionResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const textareaPlaceholder = useMemo(() => placeholderForSource(sourceType), [sourceType]);
  const sourceWarnings = useMemo(() => buildSourceWarnings(sourceType, rawText), [sourceType, rawText]);

  useEffect(() => {
    const persisted = readPersistedDraft();
    if (persisted && (persisted.sourceType || persisted.rawText.trim())) {
      setSourceType(persisted.sourceType);
      setRawText(persisted.rawText);
      setRestoredAt(persisted.updatedAt || new Date().toISOString());
    }
    setDraftLoaded(true);
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    const payload: PersistedBuildDraft = {
      sourceType,
      rawText,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(BUILD_DRAFT_STORAGE_KEY, JSON.stringify(payload));
  }, [draftLoaded, sourceType, rawText]);

  function getSubmissionIntakeId(value: BuildSubmissionResult): string | undefined {
    if (!value.ok) return undefined;
    return value.queue?.intakeId || value.debug?.intakeId;
  }

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
              debug: normalized.debug,
            }
          : { error: normalized.error, debug: normalized.debug },
      });

      const intakeId = getSubmissionIntakeId(normalized);
      if (normalized.ok && intakeId) {
        router.push(`/admin/validate?${new URLSearchParams({ intakeId }).toString()}`);
      }
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
        <p className="mt-1 text-xs text-gray-500">
          Draft input is kept in this browser so pasted data does not disappear across navigation or remounts.
        </p>
        {restoredAt ? <p className="mt-1 text-xs text-amber-700">Restored local draft from {restoredAt}.</p> : null}
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
              {SOURCE_LABELS[source]}
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

          <SourceGuidanceCard sourceType={sourceType} />

          {sourceWarnings.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="font-medium">Input warning</div>
              <div className="mt-1 space-y-1">
                {sourceWarnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            </div>
          ) : null}

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
          {result.ok ? <p className="mt-3 text-sm font-medium text-green-800">Next: review this submission.</p> : null}
          {result.debug ? <BuildDebugPanel result={result} /> : null}
        </div>
      ) : null}

      <NextActionLink href="/admin/validate" text="Open review queue" />
    </div>
  );
}

function SourceGuidanceCard({ sourceType }: { sourceType: BuildSourceType }) {
  const guidance = SOURCE_GUIDANCE[sourceType];

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
      <h3 className="font-medium text-gray-900">{SOURCE_LABELS[sourceType]} Guidance</h3>
      <div className="mt-3 space-y-2 text-gray-700">
        <div>
          <span className="font-medium text-gray-900">What to paste:</span> {guidance.whatToPaste}
        </div>
        <div>
          <span className="font-medium text-gray-900">What not to paste:</span> {guidance.whatNotToPaste}
        </div>
        <div>
          <span className="font-medium text-gray-900">Example:</span>
          <pre className="mt-1 whitespace-pre-wrap rounded border border-gray-200 bg-white p-2 text-xs text-gray-700">{guidance.example}</pre>
        </div>
        <div>
          <span className="font-medium text-gray-900">What the system does next:</span> {guidance.nextStep}
        </div>
      </div>
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

function BuildDebugPanel({ result }: { result: BuildSubmissionResult }) {
  if (!result.debug) return null;

  return (
    <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-white/70 p-3 text-sm">
      <h3 className="font-medium text-gray-900">Build Runtime Debug</h3>
      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
        <DebugRow label="Submit outcome" value={result.debug.submitOutcome} />
        <DebugRow label="Submitted at" value={result.debug.submittedAt} />
        <DebugRow label="Runtime root" value={result.debug.runtimeRoot} />
        <DebugRow label="Canonical store" value={result.debug.canonicalStoreMode} />
        <DebugRow label="Storage mode" value={result.debug.storageMode} />
        <DebugRow label="Environment" value={result.debug.environment} />
        <DebugRow label="Instance" value={`${result.debug.instanceHost} / pid ${result.debug.instancePid}`} />
        <DebugRow label="Intake ID" value={result.debug.intakeId || "n/a"} />
        <DebugRow label="Records received" value={String(result.debug.recordsReceived ?? "n/a")} />
        <DebugRow label="DORA queued" value={String(result.debug.doraQueued ?? "n/a")} />
        <DebugRow label="Social queued" value={String(result.debug.socialQueued ?? "n/a")} />
      </div>
    </div>
  );
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="break-all text-gray-900">{value}</div>
    </div>
  );
}
