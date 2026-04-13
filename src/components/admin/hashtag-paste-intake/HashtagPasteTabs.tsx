"use client";

import { useState } from "react";
import type { HashtagPasteIntakeResult, ProviderCandidate } from "@/lib/hashtag-paste-intake/types";
import { ClientSignalsTab } from "./ClientSignalsTab";
import { ParsedPostsTab } from "./ParsedPostsTab";
import { ProviderCandidatesTab } from "./ProviderCandidatesTab";
import { RawPasteTab } from "./RawPasteTab";
import { TaggedHandlesTab } from "./TaggedHandlesTab";

type TabKey = "raw" | "posts" | "providers" | "tagged" | "clients";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "raw", label: "Raw Paste" },
  { key: "posts", label: "Parsed Posts" },
  { key: "providers", label: "Provider Candidates" },
  { key: "tagged", label: "Tagged Handles" },
  { key: "clients", label: "Client Signals" },
];

type HashtagPasteTabsProps = {
  result: HashtagPasteIntakeResult | null;
  onCreateDraft: (candidate: ProviderCandidate) => Promise<{ ok: boolean; draftId?: string; error?: string }>;
};

export function HashtagPasteTabs({ result, onCreateDraft }: HashtagPasteTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("providers");

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              activeTab === tab.key
                ? "bg-neutral-900 text-white"
                : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "raw" ? <RawPasteTab result={result} /> : null}
      {activeTab === "posts" ? <ParsedPostsTab result={result} /> : null}
      {activeTab === "providers" ? <ProviderCandidatesTab result={result} onCreateDraft={onCreateDraft} /> : null}
      {activeTab === "tagged" ? <TaggedHandlesTab result={result} /> : null}
      {activeTab === "clients" ? <ClientSignalsTab result={result} /> : null}
    </section>
  );
}
