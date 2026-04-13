"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CaptureSummaryCard } from "@/components/admin/external-site-capture/CaptureSummaryCard";
import { ExternalSiteTabs } from "@/components/admin/external-site-capture/ExternalSiteTabs";
import { MappingControlsCard } from "@/components/admin/external-site-capture/MappingControlsCard";
import { CreateDraftProfileButton } from "@/components/admin/external-site-import/CreateDraftProfileButton";
import type {
  ExternalSiteCaptureRequest,
  ExternalSiteCaptureResponse,
  ExternalSiteCaptureSnapshot,
  ExternalSiteRawResult,
  ExtractedBusinessProfile,
  ExternalSourceType,
  MappingControlState,
  VmbMappedProfile,
} from "@/lib/external-site-capture/types";
import type { ImportedProfileDraft } from "@/lib/external-site-import/types";

const DEFAULT_URL = "https://nightingaleukrainiannails.glossgenius.com/";
const DEFAULT_CONTROLS: MappingControlState = {
  buildHero: true,
  buildServiceCards: true,
  buildFavoriteCards: true,
  buildReferralBlock: true,
  buildGiftBlock: true,
  buildPortfolioGrid: true,
};

type SnapshotResponse = {
  ok: boolean;
  error?: string;
  snapshot?: ExternalSiteCaptureSnapshot;
};

type DraftCreateResponse = {
  ok: boolean;
  error?: string;
  draft?: ImportedProfileDraft;
};

export function ExternalSiteCapturePanel() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [sourceType, setSourceType] = useState<ExternalSourceType>("glossgenius");
  const [controls, setControls] = useState<MappingControlState>(DEFAULT_CONTROLS);
  const [request, setRequest] = useState<ExternalSiteCaptureRequest | null>(null);
  const [raw, setRaw] = useState<ExternalSiteRawResult | null>(null);
  const [extracted, setExtracted] = useState<ExtractedBusinessProfile | null>(null);
  const [mapped, setMapped] = useState<VmbMappedProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [lastSnapshotId, setLastSnapshotId] = useState<string | null>(null);
  const [lastDraftId, setLastDraftId] = useState<string | null>(null);

  const hasResult = Boolean(request && raw && extracted && mapped);

  const actionRows = useMemo(
    () => [
      { label: "Request", value: request ? `${request.sourceType} capture ready` : "No capture yet" },
      {
        label: "Snapshot",
        value: hasResult ? (lastSnapshotId ? `Saved: ${lastSnapshotId}` : "Ready to save") : "Capture required before save",
      },
      {
        label: "Draft",
        value: hasResult ? (lastDraftId ? `Created: ${lastDraftId}` : "Ready to create") : "Capture required before draft create",
      },
    ],
    [hasResult, lastDraftId, lastSnapshotId, request]
  );

  async function handleCapture() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/external-site-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, sourceType }),
      });
      const json = (await response.json()) as ExternalSiteCaptureResponse;
      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Capture failed");
      }
      setRequest(json.request);
      setRaw(json.raw);
      setExtracted(json.extracted);
      setMapped(json.mapped);
      setLastSnapshotId(null);
      setLastDraftId(null);
      setStatus("Capture complete. Review the tabs and save a snapshot or create a draft profile.");
    } catch (captureError: unknown) {
      setError(captureError instanceof Error ? captureError.message : "Capture failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSnapshot() {
    if (!request || !raw || !extracted || !mapped) return;
    setSavingSnapshot(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/external-site-capture/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, raw, extracted, mapped }),
      });
      const json = (await response.json()) as SnapshotResponse;
      if (!response.ok || !json.ok || !json.snapshot) {
        throw new Error(json.error || "Snapshot save failed");
      }
      setLastSnapshotId(json.snapshot.id);
      setStatus(`Snapshot saved: ${json.snapshot.id}`);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Snapshot save failed");
    } finally {
      setSavingSnapshot(false);
    }
  }

  async function handleCreateDraftProfile() {
    if (!request || !raw || !extracted || !mapped) return;
    setCreatingDraft(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/external-site-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request,
          mapped,
          extracted,
          snapshotId: lastSnapshotId || undefined,
          parseConfidence: mapped.parseConfidence,
        }),
      });
      const json = (await response.json()) as DraftCreateResponse;
      if (!response.ok || !json.ok || !json.draft) {
        throw new Error(json.error || "Draft profile creation failed");
      }
      setLastDraftId(json.draft.id);
      setStatus(`Draft profile created: ${json.draft.id}`);
    } catch (draftError: unknown) {
      setError(draftError instanceof Error ? draftError.message : "Draft profile creation failed");
    } finally {
      setCreatingDraft(false);
    }
  }

  function handleReset() {
    setUrl(DEFAULT_URL);
    setSourceType("glossgenius");
    setControls(DEFAULT_CONTROLS);
    setRequest(null);
    setRaw(null);
    setExtracted(null);
    setMapped(null);
    setError(null);
    setStatus(null);
    setLastSnapshotId(null);
    setLastDraftId(null);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-neutral-900">Source Input</h2>
            <p className="text-sm text-neutral-600">
              Paste a live GlossGenius or external salon URL to test capture, parsing, mapping, and VMB preview.
            </p>
          </div>

          <div className="grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-neutral-700">URL</span>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
                placeholder="https://nightingaleukrainiannails.glossgenius.com/"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-neutral-700">Source Type</span>
              <select
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value as ExternalSourceType)}
                className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
              >
                <option value="glossgenius">GlossGenius</option>
                <option value="vagaro">Vagaro</option>
                <option value="square">Square</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleCapture()}
              disabled={busy}
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Fetching..." : "Fetch + Parse + Map"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={busy || savingSnapshot || creatingDraft}
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-60"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => void handleSaveSnapshot()}
              disabled={!hasResult || savingSnapshot || busy || creatingDraft}
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-60"
            >
              {savingSnapshot ? "Saving..." : "Save Snapshot"}
            </button>
            <CreateDraftProfileButton
              onClick={() => void handleCreateDraftProfile()}
              disabled={!hasResult || busy || savingSnapshot}
              busy={creatingDraft}
            />
          </div>

          {error ? <div className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          {status ? (
            <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <div>{status}</div>
              {lastDraftId ? (
                <div className="mt-1">
                  <Link href="/admin/source-intake/imported-profiles" className="font-medium underline">
                    Open imported profiles
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <CaptureSummaryCard extracted={extracted} mapped={mapped} />
        <MappingControlsCard
          controls={controls}
          onChange={(key, value) => setControls((current) => ({ ...current, [key]: value }))}
        />

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-neutral-900">Actions</h2>
            <p className="text-sm text-neutral-600">
              Save Snapshot archives raw capture output. Create Draft Profile converts the mapped result into an admin draft.
            </p>
          </div>
          <div className="grid gap-3 text-sm">
            {actionRows.map((row) => (
              <div key={row.label} className="grid gap-1">
                <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{row.label}</div>
                <div className="text-neutral-800">{row.value}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <ExternalSiteTabs raw={raw} extracted={extracted} mapped={mapped} controls={controls} />
    </div>
  );
}
