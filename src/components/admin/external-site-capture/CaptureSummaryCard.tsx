"use client";

import type { ExtractedBusinessProfile, VmbMappedProfile } from "@/lib/external-site-capture/types";

type CaptureSummaryCardProps = {
  extracted: ExtractedBusinessProfile | null;
  mapped: VmbMappedProfile | null;
};

function yesNoLabel(value: boolean): string {
  return value ? "Yes" : "No";
}

export function CaptureSummaryCard({ extracted, mapped }: CaptureSummaryCardProps) {
  const rows = extracted
    ? [
        { label: "Business Name", value: extracted.businessName || "n/a" },
        { label: "Source Type", value: extracted.sourceType },
        { label: "Booking Link", value: yesNoLabel(Boolean(extracted.bookingUrl)) },
        { label: "Instagram", value: yesNoLabel(Boolean(extracted.socialLinks.instagramUrl)) },
        { label: "Services Count", value: String(extracted.services.length) },
        { label: "Providers Count", value: String(extracted.providers.length) },
        { label: "Portfolio Images Count", value: String(extracted.imageUrls.length) },
        { label: "Hero Image Found", value: yesNoLabel(Boolean(extracted.heroImageUrl)) },
        { label: "Parse Confidence", value: mapped?.parseConfidence || "n/a" },
      ]
    : [];

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-neutral-900">Capture Summary</h2>
        <p className="text-sm text-neutral-600">Quick read on what the capture pipeline extracted.</p>
      </div>
      {extracted ? (
        <div className="grid gap-3 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="grid gap-1">
              <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{row.label}</div>
              <div className="break-all text-neutral-800">{row.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-neutral-500">Run a capture to populate the summary.</p>
      )}
    </section>
  );
}
