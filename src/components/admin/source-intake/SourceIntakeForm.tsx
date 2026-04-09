"use client";

import { useState } from "react";
import { SOURCE_TYPES, type ParsedCandidateRow, type SourceIntakeRecord, type SourceType } from "@/lib/source-intake/types";

type FormState = {
  sourceLabel: string;
  sourceType: SourceType;
  sourceUrl: string;
  facilityId: string;
  facilityName: string;
  city: string;
  state: string;
  notes: string;
  rawText: string;
};

type SourceIntakeFormProps = {
  onSuccess: (payload: { intake: SourceIntakeRecord; parsedCandidates?: ParsedCandidateRow[] }) => void;
};

const INITIAL_STATE: FormState = {
  sourceLabel: "",
  sourceType: "scheduler_roster",
  sourceUrl: "",
  facilityId: "",
  facilityName: "",
  city: "",
  state: "",
  notes: "",
  rawText: "",
};

export function SourceIntakeForm({ onSuccess }: SourceIntakeFormProps) {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [busyAction, setBusyAction] = useState<"save" | "save_parse" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(mode: "save" | "save_parse") {
    setBusyAction(mode);
    setError(null);
    setSuccess(null);
    try {
      const createRes = await fetch("/api/source-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const createJson = (await createRes.json()) as {
        ok: boolean;
        error?: string;
        intake?: SourceIntakeRecord;
      };
      if (!createRes.ok || !createJson.ok || !createJson.intake) {
        throw new Error(createJson.error || "Failed to create intake");
      }

      if (mode === "save_parse") {
        const parseRes = await fetch(`/api/source-intake/${encodeURIComponent(createJson.intake.id)}/parse`, {
          method: "POST",
        });
        const parseJson = (await parseRes.json()) as {
          ok: boolean;
          error?: string;
          intake?: SourceIntakeRecord;
          parsedCandidates?: ParsedCandidateRow[];
        };
        if (!parseRes.ok || !parseJson.ok || !parseJson.intake) {
          throw new Error(parseJson.error || "Failed to parse intake");
        }
        onSuccess({ intake: parseJson.intake, parsedCandidates: parseJson.parsedCandidates ?? [] });
        setSuccess("Intake saved and parsed.");
      } else {
        onSuccess({ intake: createJson.intake });
        setSuccess("Intake saved.");
      }

      setForm(INITIAL_STATE);
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "Request failed");
    } finally {
      setBusyAction(null);
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const busy = busyAction !== null;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Source Intake</h2>
          <p className="text-sm text-neutral-600">Paste roster or team source text, then optionally parse and review it immediately.</p>
        </div>
        {success ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">{success}</span> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Source Label</span>
          <input
            value={form.sourceLabel}
            onChange={(event) => update("sourceLabel", event.target.value)}
            className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
            placeholder="ColorByKiya"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Source Type</span>
          <select
            value={form.sourceType}
            onChange={(event) => update("sourceType", event.target.value as SourceType)}
            className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
          >
            {SOURCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Source URL</span>
          <input
            value={form.sourceUrl}
            onChange={(event) => update("sourceUrl", event.target.value)}
            className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
            placeholder="https://..."
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Facility ID</span>
          <input
            value={form.facilityId}
            onChange={(event) => update("facilityId", event.target.value)}
            className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
            placeholder="fac_..."
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Facility Name</span>
          <input
            value={form.facilityName}
            onChange={(event) => update("facilityName", event.target.value)}
            className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
            placeholder="ColorByKiya"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-neutral-700">City</span>
            <input
              value={form.city}
              onChange={(event) => update("city", event.target.value)}
              className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-neutral-700">State</span>
            <input
              value={form.state}
              onChange={(event) => update("state", event.target.value)}
              className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
            />
          </label>
        </div>
        <label className="grid gap-1 text-sm md:col-span-2">
          <span className="font-medium text-neutral-700">Notes</span>
          <input
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
            className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
            placeholder="Optional review notes"
          />
        </label>
        <label className="grid gap-1 text-sm md:col-span-2">
          <span className="font-medium text-neutral-700">Raw Text</span>
          <textarea
            value={form.rawText}
            onChange={(event) => update("rawText", event.target.value)}
            className="min-h-64 rounded-xl border border-neutral-300 px-3 py-2 font-mono text-sm outline-none focus:border-neutral-500"
            placeholder="Paste source text here"
          />
        </label>
      </div>

      {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit("save")}
          className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busyAction === "save" ? "Saving..." : "Save Intake"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit("save_parse")}
          className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busyAction === "save_parse" ? "Saving + Parsing..." : "Save + Parse"}
        </button>
      </div>
    </section>
  );
}
