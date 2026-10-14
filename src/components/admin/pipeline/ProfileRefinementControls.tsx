"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CandidateProfile } from "@/lib/admin/pipeline/profile-types";
import type { RefinementQueueItem } from "@/lib/admin/pipeline/profile-presentation";

export const PROFILE_PASS_LIMIT = 20;
export const PROFILE_BATCH_LIMIT = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_KEY = "profile-refinement:fact-recovery-v2";
type ResultStatus = "completed" | "cached" | "busy" | "skipped" | "error";
export type RefinementResult = { reviewKey: string; status: ResultStatus; profile?: CandidateProfile; error?: string };
type Ledger = { scopes: Record<string, number>; attempts: Record<string, number> };
type Progress = { running: boolean; processed: number; total: number; results: RefinementResult[]; error?: string };
// Only accessed by browser effects/events. Also guards remounts if sessionStorage is disabled.
let browserLedger: Ledger = { scopes: {}, attempts: {} };

export function selectProfileChecks(rows: readonly RefinementQueueItem[], attempts: Record<string, number>, now: number): RefinementQueueItem[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!row.eligible || seen.has(row.reviewKey)) return false;
    seen.add(row.reviewKey);
    const next = row.nextAttemptAt ? Date.parse(row.nextAttemptAt) : NaN;
    if (Number.isFinite(next) && next > now) return false;
    const attempted = attempts[row.reviewKey];
    return !attempted || now - attempted >= DAY_MS;
  });
}

function readLedger(): Ledger {
  try {
    const raw = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null") as Ledger | null;
    if (raw?.scopes && raw?.attempts) {
      for (const group of ["scopes", "attempts"] as const) {
        for (const [key, value] of Object.entries(raw[group])) {
          if (Number.isFinite(value) && value > Date.now() - DAY_MS) browserLedger[group][key] = value;
        }
      }
    }
  } catch { /* Session memory remains available in restricted/private browsers. */ }
  return browserLedger;
}

function saveLedger(ledger: Ledger) {
  browserLedger = ledger;
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(ledger)); } catch { /* Browser-memory guard still prevents loops. */ }
}

/** Bounded sequential requests. A navigation abort never starts the next batch. */
export async function runProfilePass(
  reviewKeys: readonly string[],
  signal: AbortSignal,
  onStart: (keys: string[]) => void,
  onResults: (results: RefinementResult[]) => void,
  request: typeof fetch = fetch,
): Promise<void> {
  const keys = [...new Set(reviewKeys)].slice(0, PROFILE_PASS_LIMIT);
  for (let start = 0; start < keys.length; start += PROFILE_BATCH_LIMIT) {
    if (signal.aborted) return;
    const batch = keys.slice(start, start + PROFILE_BATCH_LIMIT);
    onStart(batch);
    const response = await request("/api/admin/profile-refinements", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify({ reviewKeys: batch }), signal,
    });
    if (signal.aborted) return;
    const data = await response.json().catch(() => null);
    if (signal.aborted) return;
    if (!response.ok || data?.ok !== true || !Array.isArray(data.results)) {
      throw new Error(`Profile check failed (HTTP ${response.status})${typeof data?.error === "string" ? `: ${data.error}` : ": unexpected response"}`);
    }
    const accepted = new Set<ResultStatus>(["completed", "cached", "busy", "skipped", "error"]);
    const results: RefinementResult[] = batch.map((reviewKey) => {
      const result = data.results.find((item: RefinementResult) => item?.reviewKey === reviewKey && accepted.has(item.status));
      return result || { reviewKey, status: "error", error: "The server returned no result for this row." };
    });
    onResults(results);
  }
}

export default function ProfileRefinementControls({ rows, scope, checkedAt, automatic = true, onComplete }: {
  rows: RefinementQueueItem[]; scope: string; checkedAt: string; automatic?: boolean; onComplete?: () => void;
}) {
  const router = useRouter();
  const active = useRef<AbortController | null>(null);
  const ledger = useRef<Ledger>({ scopes: {}, attempts: {} });
  const [progress, setProgress] = useState<Progress>({ running: false, processed: 0, total: 0, results: [] });
  const [failedKeys, setFailedKeys] = useState<string[]>([]);
  const [clock, setClock] = useState(Date.parse(checkedAt));
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const eligible = selectProfileChecks(rows, attempts, clock);

  const run = useCallback(async (retryKeys?: string[]) => {
    if (active.current) return;
    const now = Date.now();
    ledger.current = readLedger();
    const keys = (retryKeys || selectProfileChecks(rows, ledger.current.attempts, now).map((row) => row.reviewKey)).slice(0, PROFILE_PASS_LIMIT);
    if (!keys.length) { setClock(now); return; }
    const controller = new AbortController();
    active.current = controller;
    setProgress({ running: true, processed: 0, total: keys.length, results: [] });
    setFailedKeys([]);
    let processed = 0;
    const attempted: string[] = [];
    const results: RefinementResult[] = [];
    let failure: string | undefined;
    try {
      await runProfilePass(keys, controller.signal, (batch) => {
        attempted.push(...batch);
        for (const key of batch) ledger.current.attempts[key] = Date.now();
        saveLedger(ledger.current);
        setAttempts({ ...ledger.current.attempts });
      }, (batchResults) => {
        processed += batchResults.length;
        results.push(...batchResults);
        if (active.current === controller && !controller.signal.aborted) {
          setProgress({ running: true, processed, total: keys.length, results: [...results] });
        }
      });
    } catch (error) {
      if (!controller.signal.aborted) failure = error instanceof Error ? error.message : "Profile check failed.";
    } finally {
      if (active.current === controller) {
        active.current = null;
        if (!controller.signal.aborted) {
          setProgress({ running: false, processed, total: keys.length, results, error: failure });
          setFailedKeys([...new Set([...results.filter((result) => result.status === "error").map((result) => result.reviewKey), ...(failure ? attempted.filter((key) => !results.some((result) => result.reviewKey === key)) : [])])]);
          setClock(Date.now());
          // One refresh for the entire pass, never one per result or per render.
          if (processed > 0) { router.refresh(); onComplete?.(); }
        }
      }
    }
  }, [rows, router, onComplete]);

  useEffect(() => {
    // Deferring the claim makes the Strict Mode setup/cleanup/setup cycle harmless.
    const timer = window.setTimeout(() => {
      ledger.current = readLedger();
      setAttempts({ ...ledger.current.attempts });
      const now = Date.now();
      setClock(now);
      if (!automatic || (ledger.current.scopes[scope] && now - ledger.current.scopes[scope] < DAY_MS)) return;
      if (!selectProfileChecks(rows, ledger.current.attempts, now).length) return;
      ledger.current.scopes[scope] = now;
      saveLedger(ledger.current);
      void run();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      if (active.current) {
        active.current.abort();
        active.current = null;
        // Sorting can replace server props without unmounting this component.
        // The cancelled pass must release its visible busy state as well as its request.
        setProgress((current) => ({ ...current, running: false, error: "Check paused because the view changed. Previously attempted rows can be retried." }));
      }
    };
  }, [scope, automatic, rows, run]);

  const counts = progress.results.reduce<Partial<Record<ResultStatus, number>>>((all, result) => {
    all[result.status] = (all[result.status] || 0) + 1;
    return all;
  }, {});
  const errors = progress.results.filter((result) => result.status === "error");
  const dueRows = selectProfileChecks(rows, {}, clock);
  const due = dueRows.length;
  const previousAttempts = dueRows.filter((row) => attempts[row.reviewKey]).slice(0, PROFILE_PASS_LIMIT).map((row) => row.reviewKey);

  return <section className="rounded-xl border border-blue-200 bg-blue-50 p-4" aria-label="Profile checks" aria-busy={progress.running}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold text-blue-950">Profile checks</h2>
        <p className="mt-1 text-sm text-blue-900">{automatic ? "One automatic pass when this queue opens, guarded against repeat checks for 24 hours. " : "Check the exact source links for this row. "}Up to 20 rows per pass, 3 per request.</p>
        <p className="mt-1 text-xs text-blue-900">Saved source facts appear immediately. Checks add derived observations; approval, rejection, merged records and original evidence stay unchanged.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={progress.running || !eligible.length} onClick={() => void run()} className="rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{progress.running ? "Checking…" : `Check next ${Math.min(PROFILE_PASS_LIMIT, eligible.length) || PROFILE_PASS_LIMIT}`}</button>
        {failedKeys.length ? <button type="button" disabled={progress.running} onClick={() => void run(failedKeys)} className="rounded border border-blue-700 bg-white px-3 py-2 text-sm text-blue-900 disabled:opacity-50">Retry {failedKeys.length} failed</button> : null}
        {!failedKeys.length && !progress.running && previousAttempts.length ? <button type="button" onClick={() => void run(previousAttempts)} className="rounded border border-blue-700 bg-white px-3 py-2 text-sm text-blue-900">Retry {previousAttempts.length} previously attempted</button> : null}
      </div>
    </div>
    <div className="mt-3 text-sm text-blue-950" role="status" aria-live="polite">
      {progress.total ? <p>{progress.running ? "Checking" : progress.error ? "Stopped" : "Pass finished"}: {progress.processed}/{progress.total} rows processed. Budget: {PROFILE_PASS_LIMIT} rows maximum.</p> : null}
      <p>{eligible.length} eligible and unattempted in this session. {Math.max(0, due - eligible.length)} already attempted. {rows.length - due} waiting for cache expiry or without a supported public link.</p>
      {progress.results.length ? <p>{Object.entries(counts).map(([status, count]) => `${count} ${status}`).join(" · ")}</p> : null}
      {!eligible.length ? <p className="mt-1 text-xs">No further automatic checks are queued. Unknown or protected sources remain unresolved.</p> : null}
    </div>
    {progress.running ? <progress className="mt-2 h-2 w-full" max={progress.total} value={progress.processed} aria-label="Profile checks completed" /> : null}
    {progress.error ? <p role="alert" className="mt-2 break-words text-sm text-red-800">{progress.error} No more requests were sent in this pass.</p> : null}
    {errors.length ? <ul className="mt-2 space-y-1 text-sm text-red-800" aria-label="Profile check errors">{errors.map((result) => <li className="break-words" key={result.reviewKey}>{result.reviewKey}: {result.error || "Unable to check this source."}</li>)}</ul> : null}
  </section>;
}
