"use client";

import { useCallback, useState } from "react";
import { canPromoteResolverRecord } from "@/lib/unknown-resolver/resolver-category-guards";
import type { UnknownResolverRecord } from "@/lib/unknown-resolver/resolver-types";
import type { PromoteToOutreachInput } from "@/lib/unknown-resolver/resolver-storage";
import { HOUSE_CLEANING_OUTREACH_CHIPS, HOUSE_CLEANING_PITCH_LABELS } from "@/lib/unknown-resolver/resolver-outreach-labels";

type Props = {
  record: UnknownResolverRecord;
  onPromote: (input: PromoteToOutreachInput) => void;
};

function toggleTag(tags: string[], tag: string): string[] {
  return tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
}

export default function ResolverPromoteSection({ record, onPromote }: Props) {
  const [tags, setTags] = useState<string[]>([]);
  const [pitch, setPitch] = useState<string | null>(null);

  const promoted = record.promotedAt != null;

  const doPromote = useCallback(() => {
    onPromote({ outreachTags: tags, pitchLabel: pitch });
  }, [onPromote, pitch, tags]);

  if (record.operatorDecision !== "yes") return null;

  if (!canPromoteResolverRecord(record)) {
    return (
      <div className="rounded border border-amber-200 bg-amber-50/90 px-3 py-2 text-[11px] text-amber-950">
        Outreach promotion is only available for <strong>House Cleaning</strong> leads. This record is{" "}
        <span className="font-mono">{record.category}</span>.
      </div>
    );
  }

  if (promoted) {
    return (
      <div className="rounded border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900">
        <span className="font-semibold">In outreach queue</span>
        <span className="text-emerald-800">
          {" "}
          · promoted {new Date(record.promotedAt ?? "").toLocaleString()} · status <strong>{record.outreachStatus}</strong>
        </span>
        {record.outreachLabel ? <div className="mt-1 text-[11px]">Tags: {record.outreachLabel}</div> : null}
        {record.pitchLabel ? <div className="text-[11px]">Pitch: {record.pitchLabel}</div> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded border border-sky-200 bg-sky-50/50 px-3 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-sky-900">Promote to outreach</div>
      <p className="text-[11px] text-neutral-600">Select segmentation chips and an optional pitch, then promote. You can edit status later in the Outreach Queue.</p>

      <div>
        <div className="text-[10px] font-semibold text-neutral-600">Outreach chips</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {HOUSE_CLEANING_OUTREACH_CHIPS.map((chip) => {
            const on = tags.includes(chip);
            return (
              <button
                key={chip}
                type="button"
                onClick={() => setTags((t) => toggleTag(t, chip))}
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${
                  on ? "border-sky-600 bg-sky-600 text-white" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {chip}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block text-[10px] font-semibold text-neutral-600">
        Pitch label
        <select
          value={pitch ?? ""}
          onChange={(e) => setPitch(e.target.value || null)}
          className="mt-1 w-full max-w-xs rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
        >
          <option value="">— None —</option>
          {HOUSE_CLEANING_PITCH_LABELS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={doPromote}
        className="rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800"
      >
        Promote to Outreach
      </button>
    </div>
  );
}
