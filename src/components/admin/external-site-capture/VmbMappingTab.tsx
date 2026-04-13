"use client";

import type { VmbMappedProfile } from "@/lib/external-site-capture/types";

type VmbMappingTabProps = {
  mapped: VmbMappedProfile | null;
};

export function VmbMappingTab({ mapped }: VmbMappingTabProps) {
  if (!mapped) return <p className="text-sm text-neutral-500">No mapped profile yet.</p>;

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">Hero</h3>
        <div className="grid gap-2 text-sm text-neutral-700">
          <div><span className="font-medium text-neutral-800">Title:</span> {mapped.hero.title}</div>
          <div><span className="font-medium text-neutral-800">Subtitle:</span> {mapped.hero.subtitle || "n/a"}</div>
          <div><span className="font-medium text-neutral-800">Source URL:</span> {mapped.hero.sourceUrl}</div>
          <div><span className="font-medium text-neutral-800">Booking URL:</span> {mapped.hero.bookingUrl || "n/a"}</div>
          <div><span className="font-medium text-neutral-800">Hero Image:</span> {mapped.hero.heroImageUrl || "n/a"}</div>
          <div><span className="font-medium text-neutral-800">Instagram:</span> {mapped.hero.instagramUrl || "n/a"}</div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">Service Cards</h3>
          <div className="grid gap-2">
            {mapped.serviceCards.length ? mapped.serviceCards.map((card) => (
              <div key={card.id} className="rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                <div className="font-medium text-neutral-900">{card.title}</div>
                <div>{card.subtitle || "n/a"}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {card.priceLabel ? <span className="rounded-full bg-white px-2 py-1 text-neutral-700">{card.priceLabel}</span> : null}
                  {card.durationLabel ? <span className="rounded-full bg-white px-2 py-1 text-neutral-700">{card.durationLabel}</span> : null}
                </div>
                {card.imageUrl ? <div className="mt-2 break-all text-xs text-neutral-500">{card.imageUrl}</div> : null}
              </div>
            )) : <p className="text-sm text-neutral-500">No mapped services.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">Favorite Cards</h3>
          <div className="grid gap-2">
            {mapped.favoriteCards.length ? mapped.favoriteCards.map((card) => (
              <div key={card.id} className="rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                <div className="font-medium text-neutral-900">{card.title}</div>
                <div>{card.category || "n/a"}</div>
                {card.imageUrl ? <div className="mt-2 break-all text-xs text-neutral-500">{card.imageUrl}</div> : null}
              </div>
            )) : <p className="text-sm text-neutral-500">No mapped providers.</p>}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm text-sm text-neutral-700">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">Client Love Block</h3>
          <div className="font-medium text-neutral-900">{mapped.clientLoveBlock.headline}</div>
          <div className="mt-1">{mapped.clientLoveBlock.body}</div>
        </section>
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm text-sm text-neutral-700">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">Referral Block</h3>
          <div className="font-medium text-neutral-900">{mapped.referralBlock.headline}</div>
          <div className="mt-1">{mapped.referralBlock.body}</div>
        </section>
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm text-sm text-neutral-700">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">Gift Block</h3>
          <div className="font-medium text-neutral-900">{mapped.giftBlock.headline}</div>
          <div className="mt-1">{mapped.giftBlock.body}</div>
        </section>
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm text-sm text-neutral-700">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">Network Block</h3>
          <div className="font-medium text-neutral-900">{mapped.networkBlock.headline}</div>
          <div className="mt-1">{mapped.networkBlock.body}</div>
        </section>
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm text-sm text-neutral-700">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">Portfolio Summary</h3>
          <div>{mapped.portfolioImages.length} mapped portfolio images</div>
          <div className="mt-2 font-medium text-neutral-900">Parse Confidence</div>
          <div>{mapped.parseConfidence}</div>
        </section>
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm text-sm text-neutral-700">
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">Diagnostics</h3>
        {mapped.diagnostics.length ? (
          <div className="grid gap-2">
            {mapped.diagnostics.map((diagnostic) => (
              <div key={diagnostic} className="rounded-xl bg-neutral-50 px-3 py-2">
                {diagnostic}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-emerald-700">No diagnostics flagged.</div>
        )}
      </section>
    </div>
  );
}
