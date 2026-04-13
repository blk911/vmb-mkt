"use client";

import { useMemo, useState } from "react";
import { HashtagPasteTabs } from "@/components/admin/hashtag-paste-intake/HashtagPasteTabs";
import { PasteInputCard } from "@/components/admin/hashtag-paste-intake/PasteInputCard";
import { PasteSummaryCard } from "@/components/admin/hashtag-paste-intake/PasteSummaryCard";
import type { HashtagPasteIntakeRequest, HashtagPasteIntakeResult, ProviderCandidate, SocialPlatform } from "@/lib/hashtag-paste-intake/types";

const DEFAULT_REQUEST: HashtagPasteIntakeRequest = {
  platform: "instagram",
  hashtag: "#denvernails",
  geoHint: "Denver",
  serviceHint: "Nails",
  rawText: "",
};

export function HashtagPasteIntakePanel() {
  const [request, setRequest] = useState<HashtagPasteIntakeRequest>(DEFAULT_REQUEST);
  const [result, setResult] = useState<HashtagPasteIntakeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [lastSnapshotId, setLastSnapshotId] = useState<string | null>(null);

  const actionRows = useMemo(
    () => [
      { label: "Request", value: result ? `${result.request.platform} intake parsed` : "No parse yet" },
      { label: "Snapshot", value: result ? (lastSnapshotId ? `Saved: ${lastSnapshotId}` : "Ready to save") : "Parse required before save" },
    ],
    [lastSnapshotId, result]
  );

  async function handleParse() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/hashtag-paste-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const json = (await response.json()) as { ok: boolean; error?: string; result?: HashtagPasteIntakeResult };
      if (!response.ok || !json.ok || !json.result) {
        throw new Error(json.error || "Parse failed");
      }
      setResult(json.result);
      setLastSnapshotId(null);
      setStatus("Paste parsed. Review the tabs and create draft profiles explicitly from provider candidates.");
    } catch (parseError: unknown) {
      setError(parseError instanceof Error ? parseError.message : "Parse failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSnapshot() {
    if (!result) return;
    setSavingSnapshot(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/hashtag-paste-intake/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string; snapshotId?: string };
      if (!response.ok || !json.ok || !json.snapshotId) {
        throw new Error(json.error || "Snapshot save failed");
      }
      setLastSnapshotId(json.snapshotId);
      setStatus(`Snapshot saved: ${json.snapshotId}`);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Snapshot save failed");
    } finally {
      setSavingSnapshot(false);
    }
  }

  async function handleCreateDraft(candidate: ProviderCandidate): Promise<{ ok: boolean; draftId?: string; error?: string }> {
    try {
      const response = await fetch("/api/hashtag-paste-intake/create-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: result?.request ?? request, candidate }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string; draftId?: string };
      if (!response.ok || !json.ok || !json.draftId) {
        return { ok: false, error: json.error || "Draft creation failed" };
      }
      setStatus(`Draft profile created: ${json.draftId}`);
      return { ok: true, draftId: json.draftId };
    } catch (draftError: unknown) {
      return { ok: false, error: draftError instanceof Error ? draftError.message : "Draft creation failed" };
    }
  }

  function handleReset() {
    setRequest(DEFAULT_REQUEST);
    setResult(null);
    setError(null);
    setStatus(null);
    setLastSnapshotId(null);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        <PasteInputCard
          platform={request.platform}
          hashtag={request.hashtag || ""}
          geoHint={request.geoHint || ""}
          serviceHint={request.serviceHint || ""}
          rawText={request.rawText}
          busy={busy}
          savingSnapshot={savingSnapshot}
          onPlatformChange={(value: SocialPlatform) => setRequest((current) => ({ ...current, platform: value }))}
          onHashtagChange={(value) => setRequest((current) => ({ ...current, hashtag: value }))}
          onGeoHintChange={(value) => setRequest((current) => ({ ...current, geoHint: value }))}
          onServiceHintChange={(value) => setRequest((current) => ({ ...current, serviceHint: value }))}
          onRawTextChange={(value) => setRequest((current) => ({ ...current, rawText: value }))}
          onParse={() => void handleParse()}
          onReset={handleReset}
          onSaveSnapshot={() => void handleSaveSnapshot()}
          canSaveSnapshot={Boolean(result)}
        />

        {error ? <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {status ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{status}</div> : null}

        <PasteSummaryCard result={result} />

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-neutral-900">Actions</h2>
            <p className="text-sm text-neutral-600">
              Parse builds structured social evidence. Save Snapshot archives the current parse result.
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

      <HashtagPasteTabs result={result} onCreateDraft={handleCreateDraft} />
    </div>
  );
}
