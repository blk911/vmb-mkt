"use client";

import type { ExtractedBusinessProfile } from "@/lib/external-site-capture/types";

type ExtractedDataTabProps = {
  extracted: ExtractedBusinessProfile | null;
};

function ListSection({ title, values }: { title: string; values: string[] }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-neutral-900">{title}</h3>
      {values.length ? (
        <div className="grid gap-2 text-sm text-neutral-700">
          {values.map((value) => (
            <div key={value} className="break-all rounded-xl bg-neutral-50 px-3 py-2">
              {value}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-neutral-500">None found.</p>
      )}
    </section>
  );
}

export function ExtractedDataTab({ extracted }: ExtractedDataTabProps) {
  if (!extracted) return <p className="text-sm text-neutral-500">No extracted data yet.</p>;

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">Business</h3>
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div><span className="font-medium text-neutral-800">Business Name:</span> {extracted.businessName || "n/a"}</div>
          <div><span className="font-medium text-neutral-800">Source Type:</span> {extracted.sourceType}</div>
          <div><span className="font-medium text-neutral-800">Hero Image:</span> {extracted.heroImageUrl || "n/a"}</div>
          <div><span className="font-medium text-neutral-800">Logo Image:</span> {extracted.logoImageUrl || "n/a"}</div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm text-sm">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">Contact</h3>
          <div className="grid gap-2 text-neutral-700">
            <div><span className="font-medium text-neutral-800">Phone:</span> {extracted.contact.phone || "n/a"}</div>
            <div><span className="font-medium text-neutral-800">Address:</span> {extracted.contact.address || "n/a"}</div>
            <div><span className="font-medium text-neutral-800">Booking:</span> {extracted.bookingUrl || "n/a"}</div>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm text-sm">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">Social Links</h3>
          <div className="grid gap-2 text-neutral-700">
            <div><span className="font-medium text-neutral-800">Instagram:</span> {extracted.socialLinks.instagramUrl || "n/a"}</div>
            <div><span className="font-medium text-neutral-800">Facebook:</span> {extracted.socialLinks.facebookUrl || "n/a"}</div>
            <div><span className="font-medium text-neutral-800">TikTok:</span> {extracted.socialLinks.tiktokUrl || "n/a"}</div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">Services</h3>
          {extracted.services.length ? (
            <div className="grid gap-3">
              {extracted.services.map((service) => (
                <div key={service.id} className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700">
                  <div className="font-medium text-neutral-900">{service.title}</div>
                  {service.subtitle ? <div className="mt-1">{service.subtitle}</div> : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {service.priceLabel ? <span className="rounded-full bg-white px-2 py-1 text-neutral-700">{service.priceLabel}</span> : null}
                    {service.durationLabel ? <span className="rounded-full bg-white px-2 py-1 text-neutral-700">{service.durationLabel}</span> : null}
                  </div>
                  {service.imageUrl ? <div className="mt-2 break-all text-xs text-neutral-500">{service.imageUrl}</div> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No services found.</p>
          )}
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">Providers</h3>
          {extracted.providers.length ? (
            <div className="grid gap-3">
              {extracted.providers.map((provider) => (
                <div key={provider.id} className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700">
                  <div className="font-medium text-neutral-900">{provider.name}</div>
                  {provider.title ? <div className="mt-1">{provider.title}</div> : null}
                  {provider.bio ? <div className="mt-1 text-neutral-600">{provider.bio}</div> : null}
                  {provider.imageUrl ? <div className="mt-2 break-all text-xs text-neutral-500">{provider.imageUrl}</div> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No providers found.</p>
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ListSection title="Images" values={extracted.imageUrls} />
        <ListSection title="CTA Links" values={extracted.ctaLinks} />
        <ListSection title="Raw Text Blocks" values={extracted.textBlocks} />
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">JSON Preview</h3>
          <pre className="max-h-[420px] overflow-auto rounded-xl bg-neutral-950 p-4 text-xs text-neutral-100 whitespace-pre-wrap">
            {JSON.stringify(extracted, null, 2)}
          </pre>
        </section>
      </div>
    </div>
  );
}
