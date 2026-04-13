"use client";

import { useState } from "react";

type SolaTenantImportResult = {
  inserted: number;
  skipped: number;
  totalTenants: number;
};

type SolaTenantImportFormProps = {
  containerName: string;
  busy?: boolean;
  onImport: (pastedText: string) => Promise<SolaTenantImportResult>;
};

export function SolaTenantImportForm({ containerName, busy, onImport }: SolaTenantImportFormProps) {
  const [pastedText, setPastedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SolaTenantImportResult | null>(null);

  async function handleSubmit() {
    setError(null);
    setResult(null);
    try {
      const importResult = await onImport(pastedText);
      setResult(importResult);
      setPastedText("");
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "Import failed");
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-neutral-900">Manual Tenant Paste</h3>
        <p className="text-sm text-neutral-600">Paste tenant names or best-effort tenant blocks for `{containerName}`.</p>
        <p className="mt-1 text-xs text-neutral-500">
          Supported formats: one tenant name per line, or blank-line-separated blocks with `Tenant`, `Suite`, `Phone`,
          `Instagram`, `Website`, or `Booking`.
        </p>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="font-medium text-neutral-700">Pasted Tenant Text</span>
        <textarea
          value={pastedText}
          onChange={(event) => setPastedText(event.target.value)}
          className="min-h-48 rounded-xl border border-neutral-300 px-3 py-2 font-mono text-sm outline-none focus:border-neutral-500"
          placeholder={"Color Lab Hair Studio\nLash Theory\n\nTenant: Skin Ritual\nSuite: 12\nInstagram: @skinritualdenver"}
        />
      </label>

      {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {result ? (
        <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          <div className="font-medium">Tenant import complete.</div>
          <div className="mt-1 flex flex-wrap gap-3 text-xs font-medium">
            <span>Inserted: {result.inserted}</span>
            <span>Skipped: {result.skipped}</span>
            <span>Total for container: {result.totalTenants}</span>
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={busy}
          className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Importing..." : "Import Tenants"}
        </button>
      </div>
    </section>
  );
}
