"use client";

import type { SocialPlatform } from "@/lib/hashtag-paste-intake/types";

type PasteInputCardProps = {
  platform: SocialPlatform;
  hashtag: string;
  geoHint: string;
  serviceHint: string;
  rawText: string;
  busy?: boolean;
  savingSnapshot?: boolean;
  onPlatformChange: (value: SocialPlatform) => void;
  onHashtagChange: (value: string) => void;
  onGeoHintChange: (value: string) => void;
  onServiceHintChange: (value: string) => void;
  onRawTextChange: (value: string) => void;
  onParse: () => void;
  onReset: () => void;
  onSaveSnapshot: () => void;
  canSaveSnapshot: boolean;
};

export function PasteInputCard({
  platform,
  hashtag,
  geoHint,
  serviceHint,
  rawText,
  busy,
  savingSnapshot,
  onPlatformChange,
  onHashtagChange,
  onGeoHintChange,
  onServiceHintChange,
  onRawTextChange,
  onParse,
  onReset,
  onSaveSnapshot,
  canSaveSnapshot,
}: PasteInputCardProps) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-neutral-900">Paste Input</h2>
        <p className="text-sm text-neutral-600">Paste copied hashtag/search content here.</p>
      </div>

      <div className="grid gap-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Platform</span>
          <select
            value={platform}
            onChange={(event) => onPlatformChange(event.target.value as SocialPlatform)}
            className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
          >
            <option value="instagram">Instagram</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Hashtag</span>
          <input
            value={hashtag}
            onChange={(event) => onHashtagChange(event.target.value)}
            className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
            placeholder="#denvernails"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Geo Hint</span>
          <input
            value={geoHint}
            onChange={(event) => onGeoHintChange(event.target.value)}
            className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
            placeholder="Denver"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Service Hint</span>
          <input
            value={serviceHint}
            onChange={(event) => onServiceHintChange(event.target.value)}
            className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
            placeholder="Nails"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Raw Pasted Text</span>
          <textarea
            value={rawText}
            onChange={(event) => onRawTextChange(event.target.value)}
            className="min-h-[280px] rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
            placeholder={"@nightingaleukrainiannails\nDenver Nail Tech\nDM to book Gel X sets...\n\nclient caption with @taggedhandle #denvernails"}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onParse}
          disabled={busy}
          className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Parsing..." : "Parse"}
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={busy || savingSnapshot}
          className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-60"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onSaveSnapshot}
          disabled={!canSaveSnapshot || busy || savingSnapshot}
          className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-60"
        >
          {savingSnapshot ? "Saving..." : "Save Snapshot"}
        </button>
      </div>
    </section>
  );
}
