"use client";

import type { MappingControlState, VmbMappedProfile } from "@/lib/external-site-capture/types";

type RenderPreviewTabProps = {
  mapped: VmbMappedProfile | null;
  controls: MappingControlState;
};

export function RenderPreviewTab({ mapped, controls }: RenderPreviewTabProps) {
  if (!mapped) return <p className="text-sm text-neutral-500">No preview available yet.</p>;

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        Previewing as draft imported VMB profile.
      </div>
      {controls.buildHero ? (
        <section className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-8">
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                Imported from GlossGenius
              </span>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight text-neutral-950">{mapped.hero.title}</h2>
              {mapped.hero.subtitle ? <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">{mapped.hero.subtitle}</p> : null}
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={mapped.hero.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
                >
                  View Source
                </a>
                {mapped.hero.bookingUrl ? (
                  <a
                    href={mapped.hero.bookingUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
                  >
                    Book Now
                  </a>
                ) : null}
                {mapped.hero.instagramUrl ? (
                  <a
                    href={mapped.hero.instagramUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
                  >
                    Instagram
                  </a>
                ) : null}
              </div>
            </div>
            <div className="min-h-[320px] bg-neutral-100">
              {mapped.hero.heroImageUrl ? (
                <div className="h-full min-h-[320px] w-full bg-cover bg-center" style={{ backgroundImage: `url("${mapped.hero.heroImageUrl}")` }} />
              ) : (
                <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-neutral-500">No hero image found</div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {controls.buildServiceCards ? (
        <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-xl font-semibold text-neutral-900">Service Cards</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {mapped.serviceCards.length ? mapped.serviceCards.map((card) => (
              <div key={card.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
                {card.imageUrl ? (
                  <div className="h-44 w-full bg-neutral-200 bg-cover bg-center" style={{ backgroundImage: `url("${card.imageUrl}")` }} />
                ) : null}
                <div className="p-4">
                  <div className="font-medium text-neutral-900">{card.title}</div>
                  {card.subtitle ? <div className="mt-1 text-sm text-neutral-600">{card.subtitle}</div> : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                    {card.priceLabel ? <span className="rounded-full bg-white px-2.5 py-1 text-neutral-700">{card.priceLabel}</span> : null}
                    {card.durationLabel ? <span className="rounded-full bg-white px-2.5 py-1 text-neutral-700">{card.durationLabel}</span> : null}
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-neutral-500">No mapped services yet.</div>}
          </div>
        </section>
      ) : null}

      {controls.buildFavoriteCards ? (
        <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-xl font-semibold text-neutral-900">Her Favorites / Team</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {mapped.favoriteCards.length ? mapped.favoriteCards.map((card) => (
              <div key={card.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
                {card.imageUrl ? (
                  <div className="h-36 w-full bg-neutral-200 bg-cover bg-center" style={{ backgroundImage: `url("${card.imageUrl}")` }} />
                ) : null}
                <div className="p-4">
                  <div className="font-medium text-neutral-900">{card.title}</div>
                  <div className="mt-1 text-xs uppercase tracking-wide text-neutral-500">{card.category || "Provider"}</div>
                </div>
              </div>
            )) : <div className="text-sm text-neutral-500">No provider cards yet.</div>}
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6">
        <h3 className="text-xl font-semibold text-rose-950">{mapped.clientLoveBlock.headline}</h3>
        <p className="mt-2 text-sm text-rose-900">{mapped.clientLoveBlock.body}</p>
      </section>

      {(controls.buildReferralBlock || controls.buildGiftBlock) ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {controls.buildReferralBlock ? (
            <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
              <h3 className="text-xl font-semibold text-emerald-950">{mapped.referralBlock.headline}</h3>
              <p className="mt-2 text-sm text-emerald-900">{mapped.referralBlock.body}</p>
            </section>
          ) : null}
          <section className="rounded-3xl border border-sky-200 bg-sky-50 p-6">
            <h3 className="text-xl font-semibold text-sky-950">{mapped.networkBlock.headline}</h3>
            <p className="mt-2 text-sm text-sky-900">{mapped.networkBlock.body}</p>
          </section>
        </div>
      ) : null}

      {controls.buildGiftBlock ? (
        <section className="rounded-3xl border border-violet-200 bg-violet-50 p-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-700">VMB Salon Treat</div>
          <h3 className="text-xl font-semibold text-violet-950">{mapped.giftBlock.headline}</h3>
          <p className="mt-2 text-sm text-violet-900">{mapped.giftBlock.body}</p>
        </section>
      ) : null}

      {controls.buildPortfolioGrid ? (
        <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-xl font-semibold text-neutral-900">Portfolio Preview</h3>
          {mapped.portfolioImages.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {mapped.portfolioImages.map((imageUrl) => (
                <div key={imageUrl} className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
                  <div className="h-52 w-full bg-neutral-200 bg-cover bg-center" style={{ backgroundImage: `url("${imageUrl}")` }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-neutral-500">No portfolio images found.</div>
          )}
        </section>
      ) : null}
    </div>
  );
}
