"use client";

import Link from "next/link";
import { useState } from "react";
import { CreateDraftProfileButton } from "@/components/admin/external-site-import/CreateDraftProfileButton";
import type { HashtagPasteIntakeResult, ProviderCandidate } from "@/lib/hashtag-paste-intake/types";

type ProviderCandidatesTabProps = {
  result: HashtagPasteIntakeResult | null;
  onCreateDraft: (candidate: ProviderCandidate) => Promise<{ ok: boolean; draftId?: string; error?: string }>;
};

export function ProviderCandidatesTab({ result, onCreateDraft }: ProviderCandidatesTabProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draftIds, setDraftIds] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!result) return <p className="text-sm text-neutral-500">No provider candidates yet.</p>;

  async function handleCreateDraft(candidate: ProviderCandidate) {
    setBusyId(candidate.id);
    setErrors((current) => ({ ...current, [candidate.id]: "" }));
    const response = await onCreateDraft(candidate);
    if (response.ok && response.draftId) {
      setDraftIds((current) => ({ ...current, [candidate.id]: response.draftId! }));
    } else if (response.error) {
      setErrors((current) => ({ ...current, [candidate.id]: response.error! }));
    }
    setBusyId(null);
  }

  return (
    <div className="grid gap-4">
      {result.providerCandidates.length ? (
        result.providerCandidates.map((candidate) => (
          <article key={candidate.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="font-medium text-neutral-900">@{candidate.handle}</div>
                {candidate.displayName ? <div className="text-sm text-neutral-600">{candidate.displayName}</div> : null}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white px-2.5 py-1 text-neutral-700">{candidate.confidence}</span>
                {candidate.serviceHint ? <span className="rounded-full bg-white px-2.5 py-1 text-neutral-700">{candidate.serviceHint}</span> : null}
                {candidate.geoHint ? <span className="rounded-full bg-white px-2.5 py-1 text-neutral-700">{candidate.geoHint}</span> : null}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
              <div className="rounded-xl bg-white p-3">
                <div className="text-xs uppercase tracking-wide text-neutral-500">Evidence Posts</div>
                <div className="mt-1 font-medium text-neutral-900">{candidate.evidencePostIds.length}</div>
              </div>
              <div className="rounded-xl bg-white p-3">
                <div className="text-xs uppercase tracking-wide text-neutral-500">Provider Signals</div>
                <div className="mt-1 font-medium text-neutral-900">{candidate.providerSignalCount}</div>
              </div>
              <div className="rounded-xl bg-white p-3">
                <div className="text-xs uppercase tracking-wide text-neutral-500">Client Tags</div>
                <div className="mt-1 font-medium text-neutral-900">{candidate.taggedByCount}</div>
              </div>
            </div>

            {candidate.reasons.length ? (
              <div className="mt-3 text-xs text-neutral-500">Reasons: {candidate.reasons.join(" · ")}</div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-start gap-3">
              <CreateDraftProfileButton
                onClick={() => void handleCreateDraft(candidate)}
                busy={busyId === candidate.id}
              />
              {draftIds[candidate.id] ? (
                <div className="text-sm text-emerald-700">
                  Created `{draftIds[candidate.id]}`.{" "}
                  <Link href="/admin/source-intake/imported-profiles" className="underline">
                    Open imported profiles
                  </Link>
                </div>
              ) : null}
              {errors[candidate.id] ? <div className="text-sm text-rose-700">{errors[candidate.id]}</div> : null}
            </div>
          </article>
        ))
      ) : (
        <p className="text-sm text-neutral-500">No provider candidates identified.</p>
      )}
    </div>
  );
}
