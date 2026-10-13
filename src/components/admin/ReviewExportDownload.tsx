"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const EXPORT_COLLECTIONS = ["tech_index", "adminPipelineSourceIntakes", "adminPipelineParsedCandidates", "adminPipelineDoraQueue", "adminPipelineDoraResults", "adminPipelineSocialQueue", "adminPipelineSocialResults"];

export default function ReviewExportDownload() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function download() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setFailed(false);
    setNeedsLogin(false);
    setMessage("");
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 50_000);
    try {
      const response = await fetch("/api/admin/review-export", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "X-Mkt-Review-Export": "v1" },
        signal: abort.signal,
      });
      if (!response.ok) {
        setNeedsLogin(response.status === 401);
        if (response.status === 401) throw new Error("Your session expired. Sign in again, then retry the download.");
        if (response.status === 403) throw new Error("An admin session on this site is required.");
        if (response.status === 409) throw new Error("An export is already running. Wait for it to finish before trying again.");
        if (response.status === 413 || response.status === 504) throw new Error("The export exceeded its safe size or time limit. No complete file was downloaded.");
        const detail = await response.json().catch(() => null);
        if (typeof detail?.error === "string" && /^[A-Z_]{1,80}$/.test(detail.error)) {
          throw new Error(`Export unavailable (${detail.error}). No partial file was downloaded.`);
        }
        throw new Error("The export could not be completed. No partial file was downloaded. Please try again later.");
      }
      const contents = await response.text();
      let parsed;
      try { parsed = JSON.parse(contents); }
      catch { throw new Error("The export response was not valid JSON. No file was downloaded."); }
      if (parsed?.manifest?.status !== "complete" || parsed?.manifest?.format !== "mktdecks-review-export-envelope" ||
          !parsed?.collections || Object.keys(parsed.collections).length !== EXPORT_COLLECTIONS.length ||
          EXPORT_COLLECTIONS.some((name) => !Array.isArray(parsed.collections[name]) ||
            parsed.manifest.collections?.[name]?.status !== "complete" ||
            parsed.manifest.collections[name].exportedCount !== parsed.collections[name].length ||
            parsed.manifest.collections[name].cursorExhausted !== true)) {
        throw new Error("The export did not include a complete manifest. No file was downloaded.");
      }
      if (abort.signal.aborted) throw new DOMException("Download interrupted", "AbortError");
      const blob = new Blob([contents], { type: "application/json" });
      if (blob.size > 3_500_000) throw new Error("The export exceeded its safe size limit. No file was downloaded.");
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = "mkt-review-metadata.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 30_000);
      setMessage("Download started. Keep this metadata file private.");
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error && error.name === "AbortError"
        ? "The export was interrupted or took too long. No complete file was downloaded."
        : error instanceof Error ? error.message : "The download failed. Please try again later.");
    } finally {
      clearTimeout(timeout);
      controller.current = null;
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" aria-labelledby="review-export-heading">
      <h2 id="review-export-heading" className="font-semibold">Download review metadata</h2>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">
        Export record IDs and saved review decisions from one read-only database snapshot. Contact details, notes and outreach are excluded. The file is private and may still contain identifying IDs.
      </p>
      <button type="button" onClick={download} disabled={busy} aria-busy={busy} className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60">
        {busy ? "Preparing download…" : "Download metadata JSON"}
      </button>
      {message ? <p role={failed ? "alert" : "status"} className={`mt-3 text-sm ${failed ? "text-red-700" : "text-green-700"}`}>{message}</p> : null}
      {needsLogin ? <Link href="/auth/login?next=%2Fadmin%2Freview-export" className="mt-2 inline-block text-sm font-medium text-blue-700 underline">Sign in again</Link> : null}
    </section>
  );
}
