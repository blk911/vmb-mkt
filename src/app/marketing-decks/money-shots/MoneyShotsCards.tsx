"use client";

import { useState } from "react";

const IMG = {
  card1: "/mscard1.jpg",
  card2: "/mscard2.jpg",
  card3: "/mscard3.jpg",
  card4: "/mscard4.jpg",
} as const;

type MoneyShotCard = {
  id: string;
  title: string;
  detailTitle?: string;
  image?: string;
  gallery?: string[];
  content?: {
    steps: Array<{
      heading: string;
      lines: string[];
      bullets?: string[];
    }>;
  };
};

const CARDS: MoneyShotCard[] = [
  {
    id: "#1",
    title: "Unlock Cash In your current book",
    detailTitle: "Know your clients - intimately well!",
    gallery: [IMG.card1, IMG.card2, IMG.card3, IMG.card4],
    content: {
      steps: [
        {
          heading: "1️⃣ Review Your Client List",
          lines: [
            "Who are your 10 most active clients on social media?",
            "They already influence people. They bring business passively.",
            "VMB turns that influence into captured revenue.",
          ],
        },
        {
          heading: "2️⃣ Invite Them to Join VMB (It's Free)",
          lines: [
            "Use the VMB invitation feature.",
            "There's no friction. Nothing to buy.",
            "You're inviting them into a perks + gifting ecosystem tied to your salon.",
          ],
        },
        {
          heading: "3️⃣ Introduce the Gift Feature First",
          lines: [
            "Tailor their gift request to fit their relationship.",
            "Gifting is easy psychology. It feels generous, not transactional.",
            "It brings new business through existing relationships.",
          ],
        },
        {
          heading: "4️⃣ Give your most engaged clients something better than a discount",
          lines: [
            "Now referrals aren't favors — they're opportunity.",
          ],
          bullets: [
            "First access to premium time slots",
            "Seamless gifting + invitations",
            "A way to earn by sharing",
          ],
        },
        {
          heading: "5️⃣ Your Clients Are a Renewable Revenue Source",
          lines: [
            "Here are 5 closing statements that feel confident but not hypey:",
          ],
          bullets: [
            "VMB is more than a calendar — it's a client activation platform.",
            "More than payments — it creates participation.",
            "No monthly subscription required.",
            "No ad spend needed.",
            "Just smarter engagement with the clients you already have.",
          ],
        },
      ],
    },
  },
  {
    id: "#2",
    title: "One for the money, Two for the Gold",
    detailTitle: "Client relationships are your most valuable asset",
    content: {
      steps: [
        {
          heading: "1️⃣ Deep Dig Your Client List",
          lines: [
            "Look at your regulars. Your influencers. Your social butterflies.",
            "These clients already talk about you — online and in real life.",
            "VMB's invitation and gifting tools turn those conversations into booked business.",
          ],
        },
        {
          heading: "2️⃣ Pick Your Target — Full Send",
          lines: [
            "Who deserves a little pampering?",
            "A partner. A best friend. A sister. A co-worker.",
            "Clients send service gifts or request them from someone special.",
            "VMB makes gifting salon experiences simple — and irresistible.",
          ],
        },
        {
          heading: "3️⃣ Girls' Day Out",
          lines: [
            "Select a few VMB clients and spark a moment.",
            "\"Bring a friend, get a perk.\"",
            "Now one appointment becomes two chairs filled —",
            "and two new relationships started.",
          ],
        },
        {
          heading: "4️⃣ VIP Clients Drive the Engine",
          lines: [
            "Your most engaged clients unlock the VMB advantages:",
            "Your best clients become your best promoters.",
          ],
          bullets: [
            "Early access to premium appointment times",
            "Built-in gifting and invitation tools",
            "Participation in the VMB co-marketing pay plan",
          ],
        },
      ],
    },
  },
  {
    id: "#3",
    title: "Build a Team for the big win",
  },
  {
    id: "#4",
    title: "Clients connect to cash",
  },
  {
    id: "#5",
    title: "Timing is everything",
  },
];

export default function MoneyShotsCards() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="mx-auto mt-8 max-w-5xl space-y-4 px-4 pb-16">
      {CARDS.map((card, idx) => {
        const open = openIdx === idx;
        return (
          <article key={card.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setOpenIdx((prev) => (prev === idx ? null : idx))}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <div className="min-w-0">
                <h3 className="text-xl font-semibold leading-tight text-neutral-900">
                  {card.id} {card.title}
                </h3>
              </div>
              <span className="text-sm font-medium text-neutral-500">{open ? "Close" : "Open"}</span>
            </button>

            {open ? (
              <div className="border-t px-5 py-4">
                <div className="grid items-stretch gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="min-h-[150px] rounded-xl border border-neutral-200 p-4">
                    <div className="text-xl font-semibold leading-tight text-neutral-900">
                      {card.detailTitle || `${card.id} ${card.title}`}
                    </div>
                    {card.content ? (
                      <div className="mt-3 space-y-4 text-sm leading-relaxed text-neutral-700 md:text-base">
                        {card.content.steps.map((step) => (
                          <section key={step.heading} className="space-y-1.5">
                            <h4 className="font-semibold text-neutral-900">{step.heading}</h4>
                            {step.lines.map((line) => (
                              <p key={line}>{line}</p>
                            ))}
                            {step.bullets ? (
                              <ul className="list-disc space-y-1 pl-5">
                                {step.bullets.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            ) : null}
                          </section>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div
                    className="w-full overflow-hidden"
                    aria-label={`Money Shot ${card.id}`}
                    role="img"
                  >
                    {card.gallery && card.gallery.length ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 80, paddingTop: 20 }}>
                        {card.gallery.map((src, i) => (
                          <img
                            key={src}
                            src={src}
                            alt={`${card.id} media ${i + 1}`}
                            className="h-[150px] w-full rounded-md border border-neutral-200 object-cover"
                          />
                        ))}
                      </div>
                    ) : card.image ? (
                      <img
                        src={card.image}
                        alt={`Money Shot ${card.id}`}
                        className="h-[150px] w-full object-cover"
                      />
                    ) : null
                    }
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
