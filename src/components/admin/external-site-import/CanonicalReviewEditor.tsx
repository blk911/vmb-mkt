"use client";

import { ReviewFieldCard } from "@/components/admin/external-site-import/ReviewFieldCard";
import type { ImportedProfileReviewPayload } from "@/lib/external-site-review/types";

type CanonicalReviewEditorProps = {
  value: ImportedProfileReviewPayload;
  onChange: (next: ImportedProfileReviewPayload) => void;
};

function textInputClass(): string {
  return "rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500";
}

function textareaClass(): string {
  return "min-h-[88px] rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500";
}

export function CanonicalReviewEditor({ value, onChange }: CanonicalReviewEditorProps) {
  function updateField<Key extends keyof ImportedProfileReviewPayload>(key: Key, nextValue: ImportedProfileReviewPayload[Key]) {
    onChange({ ...value, [key]: nextValue });
  }

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Canonical Review Editor</h2>
        <p className="text-sm text-neutral-600">Review before promotion.</p>
      </div>

      <ReviewFieldCard title="Identity" description="Canonical business identity and lead profile fields.">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Business Name</span>
          <input
            value={value.businessName}
            onChange={(event) => updateField("businessName", event.target.value)}
            className={textInputClass()}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Subtitle</span>
          <input
            value={value.subtitle || ""}
            onChange={(event) => updateField("subtitle", event.target.value || undefined)}
            className={textInputClass()}
          />
        </label>
      </ReviewFieldCard>

      <ReviewFieldCard title="Links" description="Primary URLs that will be carried into the promoted record.">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Booking URL</span>
          <input
            value={value.bookingUrl || ""}
            onChange={(event) => updateField("bookingUrl", event.target.value || undefined)}
            className={textInputClass()}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Instagram URL</span>
          <input
            value={value.instagramUrl || ""}
            onChange={(event) => updateField("instagramUrl", event.target.value || undefined)}
            className={textInputClass()}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Hero Image URL</span>
          <input
            value={value.heroImageUrl || ""}
            onChange={(event) => updateField("heroImageUrl", event.target.value || undefined)}
            className={textInputClass()}
          />
        </label>
      </ReviewFieldCard>

      <ReviewFieldCard title="Services" description="Edit or remove imported services before promotion.">
        {value.services.length ? (
          value.services.map((service, index) => (
            <div key={service.id} className="grid gap-3 rounded-xl border border-neutral-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-neutral-800">Service {index + 1}</div>
                <button
                  type="button"
                  onClick={() => updateField("services", value.services.filter((_, itemIndex) => itemIndex !== index))}
                  className="text-xs font-medium text-rose-700"
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={service.title}
                  onChange={(event) =>
                    updateField(
                      "services",
                      value.services.map((entry, itemIndex) =>
                        itemIndex === index ? { ...entry, title: event.target.value } : entry
                      )
                    )
                  }
                  className={textInputClass()}
                  placeholder="Title"
                />
                <input
                  value={service.subtitle || ""}
                  onChange={(event) =>
                    updateField(
                      "services",
                      value.services.map((entry, itemIndex) =>
                        itemIndex === index ? { ...entry, subtitle: event.target.value || undefined } : entry
                      )
                    )
                  }
                  className={textInputClass()}
                  placeholder="Subtitle"
                />
                <input
                  value={service.priceLabel || ""}
                  onChange={(event) =>
                    updateField(
                      "services",
                      value.services.map((entry, itemIndex) =>
                        itemIndex === index ? { ...entry, priceLabel: event.target.value || undefined } : entry
                      )
                    )
                  }
                  className={textInputClass()}
                  placeholder="Price"
                />
                <input
                  value={service.durationLabel || ""}
                  onChange={(event) =>
                    updateField(
                      "services",
                      value.services.map((entry, itemIndex) =>
                        itemIndex === index ? { ...entry, durationLabel: event.target.value || undefined } : entry
                      )
                    )
                  }
                  className={textInputClass()}
                  placeholder="Duration"
                />
                <input
                  value={service.imageUrl || ""}
                  onChange={(event) =>
                    updateField(
                      "services",
                      value.services.map((entry, itemIndex) =>
                        itemIndex === index ? { ...entry, imageUrl: event.target.value || undefined } : entry
                      )
                    )
                  }
                  className={textInputClass()}
                  placeholder="Image URL"
                />
              </div>
            </div>
          ))
        ) : (
          <div className="text-sm text-neutral-500">No services in review payload.</div>
        )}
      </ReviewFieldCard>

      <ReviewFieldCard title="Providers" description="Edit or remove providers before promotion.">
        {value.providers.length ? (
          value.providers.map((provider, index) => (
            <div key={provider.id} className="grid gap-3 rounded-xl border border-neutral-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-neutral-800">Provider {index + 1}</div>
                <button
                  type="button"
                  onClick={() => updateField("providers", value.providers.filter((_, itemIndex) => itemIndex !== index))}
                  className="text-xs font-medium text-rose-700"
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={provider.name}
                  onChange={(event) =>
                    updateField(
                      "providers",
                      value.providers.map((entry, itemIndex) =>
                        itemIndex === index ? { ...entry, name: event.target.value } : entry
                      )
                    )
                  }
                  className={textInputClass()}
                  placeholder="Name"
                />
                <input
                  value={provider.title || ""}
                  onChange={(event) =>
                    updateField(
                      "providers",
                      value.providers.map((entry, itemIndex) =>
                        itemIndex === index ? { ...entry, title: event.target.value || undefined } : entry
                      )
                    )
                  }
                  className={textInputClass()}
                  placeholder="Title"
                />
                <input
                  value={provider.imageUrl || ""}
                  onChange={(event) =>
                    updateField(
                      "providers",
                      value.providers.map((entry, itemIndex) =>
                        itemIndex === index ? { ...entry, imageUrl: event.target.value || undefined } : entry
                      )
                    )
                  }
                  className={textInputClass()}
                  placeholder="Image URL"
                />
              </div>
            </div>
          ))
        ) : (
          <div className="text-sm text-neutral-500">No providers in review payload.</div>
        )}
      </ReviewFieldCard>

      <ReviewFieldCard title="Portfolio Images" description="Review and remove portfolio image URLs as needed.">
        {value.portfolioImages.length ? (
          value.portfolioImages.map((imageUrl, index) => (
            <div key={`${imageUrl}-${index}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 p-3">
              <input
                value={imageUrl}
                onChange={(event) =>
                  updateField(
                    "portfolioImages",
                    value.portfolioImages.map((entry, itemIndex) => (itemIndex === index ? event.target.value : entry))
                  )
                }
                className={`${textInputClass()} min-w-[320px] flex-1`}
              />
              <button
                type="button"
                onClick={() =>
                  updateField(
                    "portfolioImages",
                    value.portfolioImages.filter((_, itemIndex) => itemIndex !== index)
                  )
                }
                className="text-xs font-medium text-rose-700"
              >
                Remove
              </button>
            </div>
          ))
        ) : (
          <div className="text-sm text-neutral-500">No portfolio image URLs in review payload.</div>
        )}
      </ReviewFieldCard>

      <ReviewFieldCard title="Copy Blocks" description="Tune the copy that will become the canonical imported salon record.">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Referral Headline</span>
          <input
            value={value.referralBlock.headline}
            onChange={(event) =>
              updateField("referralBlock", { ...value.referralBlock, headline: event.target.value })
            }
            className={textInputClass()}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Referral Body</span>
          <textarea
            value={value.referralBlock.body}
            onChange={(event) => updateField("referralBlock", { ...value.referralBlock, body: event.target.value })}
            className={textareaClass()}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Gift Headline</span>
          <input
            value={value.giftBlock.headline}
            onChange={(event) => updateField("giftBlock", { ...value.giftBlock, headline: event.target.value })}
            className={textInputClass()}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Gift Body</span>
          <textarea
            value={value.giftBlock.body}
            onChange={(event) => updateField("giftBlock", { ...value.giftBlock, body: event.target.value })}
            className={textareaClass()}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Network Headline</span>
          <input
            value={value.networkBlock.headline}
            onChange={(event) => updateField("networkBlock", { ...value.networkBlock, headline: event.target.value })}
            className={textInputClass()}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-700">Network Body</span>
          <textarea
            value={value.networkBlock.body}
            onChange={(event) => updateField("networkBlock", { ...value.networkBlock, body: event.target.value })}
            className={textareaClass()}
          />
        </label>
      </ReviewFieldCard>
    </section>
  );
}
