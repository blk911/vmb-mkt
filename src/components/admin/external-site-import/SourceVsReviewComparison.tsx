import type { ImportedProfileDraft } from "@/lib/external-site-import/types";

function previewList(values: string[]): string {
  return values.slice(0, 3).join(", ") || "-";
}

export function SourceVsReviewComparison({ draft }: { draft: ImportedProfileDraft }) {
  const review = draft.review.payload;
  const sourceServices = draft.services.map((service) => service.title);
  const reviewServices = review.services.map((service) => service.title);
  const sourceProviders = draft.providers.map((provider) => provider.name);
  const reviewProviders = review.providers.map((provider) => provider.name);

  const rows = [
    { label: "Business name", source: draft.businessName || "-", review: review.businessName || "-" },
    { label: "Subtitle", source: draft.subtitle || "-", review: review.subtitle || "-" },
    { label: "Booking URL", source: draft.bookingUrl || "-", review: review.bookingUrl || "-" },
    { label: "Instagram URL", source: draft.instagramUrl || "-", review: review.instagramUrl || "-" },
    { label: "Hero image URL", source: draft.heroImageUrl || "-", review: review.heroImageUrl || "-" },
    {
      label: "Service count",
      source: `${draft.services.length} (${previewList(sourceServices)})`,
      review: `${review.services.length} (${previewList(reviewServices)})`,
    },
    {
      label: "Provider count",
      source: `${draft.providers.length} (${previewList(sourceProviders)})`,
      review: `${review.providers.length} (${previewList(reviewProviders)})`,
    },
    {
      label: "Portfolio count",
      source: `${draft.portfolioImages.length} (${previewList(draft.portfolioImages)})`,
      review: `${review.portfolioImages.length} (${previewList(review.portfolioImages)})`,
    },
  ];

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-neutral-900">Source vs Review</h2>
        <p className="text-sm text-neutral-600">Compare imported mapped values against the canonical review payload that promotion will use.</p>
      </div>
      <div className="grid gap-3">
        <div className="grid grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)] gap-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <div>Field</div>
          <div>Source / Imported</div>
          <div>Canonical Review</div>
        </div>
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)] gap-3 rounded-xl bg-neutral-50 p-3 text-sm">
            <div className="font-medium text-neutral-700">{row.label}</div>
            <div className="break-all text-neutral-700">{row.source}</div>
            <div className="break-all text-neutral-900">{row.review}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
