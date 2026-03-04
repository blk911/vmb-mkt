"use client";

import { useState } from "react";

type ClientCard = {
  id: string;
  title: string;
  image?: string;
  images?: string[];
  content?: {
    sections: Array<{
      heading: string;
      lines: string[];
      bullets?: string[];
    }>;
  };
};

const CARDS: ClientCard[] = [
  {
    id: "#1",
    title: "Clients Share Salons They Love",
    images: ["/forclient3c.jpg", "/forclient2.jpg", "/forclient1b.png"],
    content: {
      sections: [
        {
          heading: "Share the Salons You Love",
          lines: [
            "Friends ask where you get your hair done.",
            "Someone compliments your nails.",
            "A coworker asks about your skin routine.",
            "You already influence where people go.",
            "VMB simply connects those moments.",
          ],
        },
        {
          heading: "Invite Your Circle (It’s Free)",
          lines: [
            "Invite friends directly through VMB.",
            "No fees. No commitments.",
            "Share the salons you trust and introduce people to services they’ll love.",
          ],
        },
        {
          heading: "Send Beauty Gifts",
          lines: [
            "Sometimes the best gift isn’t another thing.",
            "It’s time to feel great.",
            "With VMB you can send salon service gifts to friends, family, or someone who deserves a little pampering.",
          ],
        },
        {
          heading: "Unlock VIP Perks",
          lines: [
            "When you share salons you love, good things come back to you.",
            "Because great recommendations deserve appreciation.",
          ],
          bullets: [
            "access to premium appointment times",
            "exclusive client perks",
            "rewards for inviting friends",
          ],
        },
      ],
    },
  },
  {
    id: "#2",
    title: "\"Did someone say Party!\"",
    images: ["/mscard1.jpg", "/forclient3b.webp", "/forclient5a.jpg"],
    content: {
      sections: [
        {
          heading: "Invite Friends to Join the Fun",
          lines: [
            "A girls’ day out, a birthday, or just a little self-care together.",
            "Invite friends through VMB and introduce them to the salons you love.",
          ],
        },
        {
          heading: "Send Beauty Gifts That Feel Personal",
          lines: [
            "Skip the usual gift cards.",
            "Send salon experiences - hair, nails, skin, brows...",
            "Her Birthday? Celebrate a birth or an anneversary? Your BF is having a 'day'?",
            "<strong>Make it personal, send a gift</strong> that puts sunshine in their day!",
          ],
        },
        {
          heading: "Make a Gift Request (Yes, Really)",
          lines: [
            "Sometimes the best gift is the one you ask for.",
            "Share a VMB gift request with someone special.",
            "A personal gift request is your preference for attention.",
          ],
        },
        {
          heading: "Celebrate Together - Earn the Perks",
          lines: [
            "When friends join through your invitations or gifts.",
            "<strong>VMB makes everyone a winner.</strong>",
            "Because great style is always better together.",
          ],
          bullets: [
            "special client <strong>perks</strong>",
            "<strong>rewards</strong> for sharing",
            "access to <strong>exclusive salon promotions.</strong>",
          ],
        },
      ],
    },
  },
  {
    id: "#3",
    title: "Co-Marketing Team; Tell me more...",
    images: ["/forclients5a.png", "/forclient5c.png", "/forclient4.jpg", "/forclients6.jpg"],
    content: {
      sections: [
        {
          heading: "Co-Marketing Team Tell Me More…",
          lines: [
            "Most salons spend money trying to get attention online.",
            "Ads. Promotions. Social media campaigns.",
            "But the truth is simple:",
            "The personal care industry has always grown through clients sharing great experiences.",
            "VMB simply recognizes that reality.",
            "Instead of pouring money into ads, VMB shares those marketing dollars with the people who actually grow salons - clients and salon owners.",
          ],
        },
        {
          heading: "🔵 Priority Booking & VIP Access",
          lines: [
            "When you participate in the VMB network, you’re more than a client.",
            "You gain access to:",
            "Because engaged clients deserve better access.",
          ],
          bullets: [
            "premium appointment availability",
            "exclusive client perks",
            "special promotions from participating salons",
          ],
        },
        {
          heading: "🔵 Share What You Love - Earn Rewards",
          lines: [
            "When friends join VMB through your invitations or gifts, you can earn rewards.",
            "You’re simply sharing the salons and services you already enjoy - and getting recognized for it.",
          ],
        },
        {
          heading: "🔵 An Open Opportunity",
          lines: [
            "Your network is unique.",
            "Friends. Family. Coworkers. Social media.",
            "Every connection creates the possibility for new salon relationships.",
            "With VMB, those connections can create ongoing rewards and benefits.",
          ],
        },
      ],
    },
  },
];

export default function ClientsCards() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="mx-auto mt-4 max-w-5xl space-y-4 px-4 pb-16">
      {CARDS.map((card, idx) => {
        const open = openIdx === idx;
        return (
          <article key={card.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setOpenIdx((prev) => (prev === idx ? null : idx))}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <h3 className="text-xl font-semibold leading-tight text-neutral-900">
                {card.id} {card.title}
              </h3>
              <span className="text-sm font-medium text-neutral-500">{open ? "Close" : "Open"}</span>
            </button>

            {open ? (
              <div className="border-t px-5 py-4">
                <div className="grid items-stretch gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="min-h-[150px] rounded-xl border border-neutral-200 p-4">
                    {card.content ? (
                      <div className="space-y-4 text-sm leading-relaxed text-neutral-700 md:text-base">
                        {card.content.sections.map((section, sIdx) => (
                          <section key={section.heading} className="space-y-1.5">
                            <h4 className="flex items-center gap-2 font-semibold text-neutral-900">
                              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-blue-600 px-1 text-xs font-bold text-white">
                                {sIdx + 1}
                              </span>
                              <span>{section.heading}</span>
                            </h4>
                            {section.lines.map((line) => (
                              <p key={line} dangerouslySetInnerHTML={{ __html: line }} />
                            ))}
                            {section.bullets ? (
                              <ul className="list-disc space-y-1 pl-5">
                                {section.bullets.map((item) => (
                                  <li key={item} dangerouslySetInnerHTML={{ __html: item }} />
                                ))}
                              </ul>
                            ) : null}
                          </section>
                        ))}
                      </div>
                    ) : (
                      <section className="space-y-1.5 text-sm leading-relaxed text-neutral-700 md:text-base">
                        <h4 className="font-semibold text-neutral-900">Content Placeholder</h4>
                        <p>Client card content will be added next.</p>
                      </section>
                    )}
                  </div>
                  <div className="w-full overflow-hidden" aria-label={`For Clients ${card.id}`} role="img">
                    {card.images && card.images.length ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 40, paddingTop: 20 }}>
                        {card.images.map((src) => (
                          <img
                            key={src}
                            src={src}
                            alt={`For Clients ${card.id}`}
                            className={
                              src === "/forclient1b.png"
                                ? "max-h-[260px] w-full rounded-md border border-neutral-200 object-contain bg-white"
                                : card.id === "#2"
                                  ? "max-h-[220px] w-full rounded-md border border-neutral-200 object-contain bg-white"
                                  : "h-[150px] w-full rounded-md border border-neutral-200 object-cover"
                            }
                          />
                        ))}
                      </div>
                    ) : card.image ? (
                      <img
                        src={card.image}
                        alt={`For Clients ${card.id}`}
                        className="h-[150px] w-full rounded-md border border-neutral-200 object-cover"
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
