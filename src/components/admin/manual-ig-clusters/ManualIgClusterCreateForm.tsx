"use client";

import { useState } from "react";
import type { ManualIgCluster } from "@/lib/manual-ig-clusters/types";

type ManualIgClusterCreateFormProps = {
  onSuccess: (cluster: ManualIgCluster) => void;
};

type FormState = {
  originHandle: string;
  market: string;
  tags: string;
  pastedText: string;
};

const INITIAL_STATE: FormState = {
  originHandle: "",
  market: "",
  tags: "",
  pastedText: "",
};

export function ManualIgClusterCreateForm({ onSuccess }: ManualIgClusterCreateFormProps) {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/manual-ig-clusters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originHandle: form.originHandle,
          market: form.market || undefined,
          tags: form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          pastedText: form.pastedText,
        }),
      });
      const json = (await response.json()) as {
        ok: boolean;
        error?: string;
        cluster?: ManualIgCluster;
      };
      if (!response.ok || !json.ok || !json.cluster) {
        throw new Error(json.error || "Failed to create cluster");
      }
      onSuccess(json.cluster);
      setSuccess("Cluster created.");
      setForm(INITIAL_STATE);
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Manual IG Cluster Intake</h2>
          <p className="text-sm text-neutral-600">Create a staged cluster from copied Instagram follow lines before accepting anything downstream.</p>
        </div>
        {success ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">{success}</span> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Origin Handle</span>
          <input
            value={form.originHandle}
            onChange={(event) => update("originHandle", event.target.value)}
            className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
            placeholder="@targetsalon"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Market</span>
          <input
            value={form.market}
            onChange={(event) => update("market", event.target.value)}
            className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
            placeholder="Denver"
          />
        </label>
        <label className="grid gap-1 text-sm md:col-span-2">
          <span className="font-medium text-neutral-700">Tags</span>
          <input
            value={form.tags}
            onChange={(event) => update("tags", event.target.value)}
            className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
            placeholder="prospect, color, network-map"
          />
        </label>
        <label className="grid gap-1 text-sm md:col-span-2">
          <span className="font-medium text-neutral-700">Pasted Follow Text</span>
          <textarea
            value={form.pastedText}
            onChange={(event) => update("pastedText", event.target.value)}
            className="min-h-64 rounded-xl border border-neutral-300 px-3 py-2 font-mono text-sm outline-none focus:border-neutral-500"
            placeholder={"jspenw\nJSW\nkarennnn.15\nKaren Ramirez"}
          />
        </label>
      </div>

      {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="mt-4">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Creating..." : "Create Cluster"}
        </button>
      </div>
    </section>
  );
}
