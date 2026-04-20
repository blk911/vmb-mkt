"use client";

import { HashtagPasteIntakePanel } from "@/components/admin/hashtag-paste-intake/HashtagPasteIntakePanel";

export default function Page() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-950">Hashtag Paste Intake</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Paste Instagram hashtag content and surface likely provider, client, and referral signals.
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Use this to manually intake hashtag/search content before building live social ingestion.
          </p>
        </div>

        <HashtagPasteIntakePanel />
      </div>
    </main>
  );
}
