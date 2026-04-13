"use client";

import { useState } from "react";
import type { ExternalSiteRawResult, ExtractedBusinessProfile, MappingControlState, VmbMappedProfile } from "@/lib/external-site-capture/types";
import { DiagnosticsTab } from "./DiagnosticsTab";
import { ExtractedDataTab } from "./ExtractedDataTab";
import { RawSourceTab } from "./RawSourceTab";
import { RenderPreviewTab } from "./RenderPreviewTab";
import { VmbMappingTab } from "./VmbMappingTab";

type TabKey = "raw" | "extracted" | "mapped" | "preview" | "diagnostics";

type ExternalSiteTabsProps = {
  raw: ExternalSiteRawResult | null;
  extracted: ExtractedBusinessProfile | null;
  mapped: VmbMappedProfile | null;
  controls: MappingControlState;
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "raw", label: "Raw Source" },
  { key: "extracted", label: "Extracted Data" },
  { key: "mapped", label: "VMB Mapping" },
  { key: "preview", label: "Render Preview" },
  { key: "diagnostics", label: "Diagnostics" },
];

export function ExternalSiteTabs({ raw, extracted, mapped, controls }: ExternalSiteTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("preview");

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

      {activeTab === "raw" ? <RawSourceTab raw={raw} /> : null}
      {activeTab === "extracted" ? <ExtractedDataTab extracted={extracted} /> : null}
      {activeTab === "mapped" ? <VmbMappingTab mapped={mapped} /> : null}
      {activeTab === "preview" ? <RenderPreviewTab mapped={mapped} controls={controls} /> : null}
      {activeTab === "diagnostics" ? <DiagnosticsTab mapped={mapped} /> : null}
    </section>
  );
}
