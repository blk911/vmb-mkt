"use client";

import { useState } from "react";
import type { SolaContainer } from "@/lib/sola-containers/types";

type SolaContainerUrlFormProps = {
  container: SolaContainer;
  busy?: boolean;
  onSave: (values: { locationPageUrl: string; directoryPageUrl: string }) => Promise<void>;
};

export function SolaContainerUrlForm({ container, busy, onSave }: SolaContainerUrlFormProps) {
  const [locationPageUrl, setLocationPageUrl] = useState(container.locationPageUrl || "");
  const [directoryPageUrl, setDirectoryPageUrl] = useState(container.directoryPageUrl || "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setSuccess(null);
    try {
      await onSave({ locationPageUrl, directoryPageUrl });
      setSuccess("URLs saved.");
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save URLs");
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-neutral-900">Parent URLs</h3>
        <p className="text-sm text-neutral-600">Curate official parent location and directory URLs before broader tenant extraction.</p>
      </div>

      <div className="grid gap-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Location Page URL</span>
          <input
            value={locationPageUrl}
            onChange={(event) => setLocationPageUrl(event.target.value)}
            className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
            placeholder="https://www.solasalonstudios.com/locations/..."
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Directory Page URL</span>
          <input
            value={directoryPageUrl}
            onChange={(event) => setDirectoryPageUrl(event.target.value)}
            className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
            placeholder="https://www.solasalonstudios.com/locations/.../professionals"
          />
        </label>
      </div>

      {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={busy}
          className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Saving..." : "Save URLs"}
        </button>
        {container.locationPageUrl ? (
          <a
            href={container.locationPageUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Open Location Page
          </a>
        ) : null}
        {container.directoryPageUrl ? (
          <a
            href={container.directoryPageUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Open Directory
          </a>
        ) : null}
      </div>
    </section>
  );
}
