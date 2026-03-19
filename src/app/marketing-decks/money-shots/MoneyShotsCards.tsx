"use client";

import { useState } from "react";
import { Graphic1Module } from "@/components/vmb-faq/Graphic1Module";
import { Graphic2Module } from "@/components/vmb-faq/Graphic2Module";

const IMG = {
  card1: "/mscard1.jpg",
  card2: "/mscard2.jpg",
  card3: "/mscard3.jpg",
  card4: "/mscard4.jpg",
  card2Extra1: "/mscard1.jpg",
  card2Extra2: "/forclients6.jpg",
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
    gallery: [IMG.card2Extra1, IMG.card2Extra2],
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
    title: "Payment Secured at Appointment Confirmation",
    content: {
      steps: [
        {
          heading: "1️⃣ Secure Prime Appointment Slots",
          lines: [
            "Appointments booked through VMB are confirmed with payment.",
            "Your most valuable time is no longer a soft hold — it becomes committed revenue.",
          ],
        },
        {
          heading: "2️⃣ Stop Losing Revenue to No-Shows",
          lines: [
            "Missed appointments and last-minute cancellations no longer wipe out hours of work.",
            "Your schedule stays protected and your daily income stays intact.",
          ],
        },
        {
          heading: "3️⃣ Every New Client Becomes a VMB Client",
          lines: [
            "Walk-ins and new customers can register instantly through VMB.",
            "Each visit grows your client network and future booking potential.",
          ],
        },
        {
          heading: "4️⃣ Your Calendar Becomes Predictable Revenue",
          lines: [
            "Instead of hoping appointments stick, VMB converts booked time into reliable income you can plan around.",
          ],
        },
      ],
    },
  },
  {
    id: "#4",
    title: "VMB: A Business Plan for Personal Care Professionals",
    content: {
      steps: [
        {
          heading: "🔵 1 Your Clients Already Promote You",
          lines: [
            "They talk about you at dinner, at work, on Instagram, in group chats.",
            "Every compliment about their hair, nails, or skin becomes a recommendation.",
            "VMB captures those conversations and turns them into <strong>real bookings and gifts.</strong>",
          ],
        },
        {
          heading: "🔵 2 Loyalty Becomes a Partnership",
          lines: [
            "Your most loyal clients already want you to succeed.",
            "With VMB they can invite friends, send service gifts, and share your salon.",
            "You're not just serving them — <strong>you're partnering with them</strong>.",
          ],
        },
        {
          heading: "🔵 3 Word of Mouth Becomes Co-Marketing",
          lines: [
            "Instead of paying for ads, you reward the clients who already promote you.",
            "Your clients become your <strong>co-marketing team</strong> — because they believe in your work.",
          ],
        },
        {
          heading: "🔵 4 Your Salon Becomes a Community",
          lines: [
            "Clients aren't just appointments anymore.",
            "They're connected to your salon through gifting, referrals, and shared experiences.",
            "That's what creates <strong>real loyalty and lasting growth</strong>.",
          ],
        },
      ],
    },
  },
  {
    id: "#5",
    title: "VMB Opens the Door to the Vault",
    content: {
      steps: [
        {
          heading: "🔵 1 Your Network Travels With You",
          lines: [
            "Clients move, travel, and recommend services wherever they go.",
            "With VMB, those connections stay inside the network.",
          ],
        },
        {
          heading: "🔵 2 Every Invitation Expands Your Reach",
          lines: [
            "When a client joins VMB, your salon becomes connected to their world.",
            "Friends, coworkers, family — every invite expands the opportunity.",
          ],
        },
        {
          heading: "🔵 3 Relationships Cross Industries",
          lines: [
            "Barbers. Stylists. Estheticians. Nail techs.",
            "Realtors. Fitness trainers. Hospitality workers.",
            "These professionals already exchange referrals every day.",
            "VMB organizes those <strong>indirect co-marketing relationships.</strong>",
          ],
        },
        {
          heading: "🔵 4 The Network Becomes Limitless",
          lines: [
            "Every new client creates new pathways to future clients.",
            "Your salon stops growing one appointment at a time",
            "and starts <strong>growing through connected communities</strong>.",
          ],
        },
      ],
    },
  },
];

export default function MoneyShotsCards() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [showGraphic1Modal, setShowGraphic1Modal] = useState(false);
  const [showGraphic2Modal, setShowGraphic2Modal] = useState(false);

  return (
    <>
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
                      {card.content ? (
                        <div className="mt-3 space-y-4 text-sm leading-relaxed text-neutral-700 md:text-base">
                          {card.id === "#3" ? (
                            <section className="space-y-1.5">
                              <p className="text-base md:text-lg"><strong>Your time is priceless — VMB makes sure you get paid.</strong></p>
                            </section>
                          ) : null}
                          {card.content.steps.map((step) => (
                            <section key={step.heading} className="space-y-1.5">
                              <h4 className="font-semibold text-neutral-900">{step.heading}</h4>
                              {step.lines.map((line) => (
                                <p
                                  key={line}
                                  dangerouslySetInnerHTML={{ __html: line }}
                                />
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
                      {card.id === "#2" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 80, paddingTop: 20 }}>
                          <button
                            type="button"
                            onClick={() => setShowGraphic2Modal(true)}
                            className="overflow-hidden rounded-md border border-neutral-200 bg-white text-left shadow-sm transition hover:border-pink-300 hover:shadow-md"
                          >
                            <div className="border-b border-neutral-200 px-3 py-2">
                              <p className="text-sm font-semibold text-neutral-900">Every Client Has a Plus One</p>
                            </div>
                            <div className="h-[150px] overflow-hidden bg-neutral-50">
                              <div className="origin-top-left scale-[0.24]">
                                <div className="w-[1000px]">
                                  <Graphic2Module />
                                </div>
                              </div>
                            </div>
                          </button>
                          {card.gallery?.map((src, i) => (
                            <img
                              key={src}
                              src={src}
                              alt={`${card.id} media ${i + 1}`}
                              className="h-[150px] w-full rounded-md border border-neutral-200 object-cover"
                            />
                          ))}
                        </div>
                      ) : card.gallery && card.gallery.length ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 54, paddingTop: 20 }}>
                          {card.id === "#1" ? (
                            <button
                              type="button"
                              onClick={() => setShowGraphic1Modal(true)}
                              className="overflow-hidden rounded-md border border-neutral-200 bg-white text-left shadow-sm transition hover:border-pink-300 hover:shadow-md"
                            >
                              <div className="border-b border-neutral-200 px-3 py-2">
                                <p className="text-sm font-semibold text-neutral-900">EZ as 1, 2, 3?</p>
                              </div>
                              <div className="h-[150px] overflow-hidden bg-neutral-50">
                                <div className="origin-top-left scale-[0.24]">
                                  <div className="w-[1000px]">
                                    <Graphic1Module />
                                  </div>
                                </div>
                              </div>
                            </button>
                          ) : null}
                          {card.gallery.slice(card.id === "#1" ? 1 : 0).map((src, i) => (
                            <img
                              key={src}
                              src={src}
                              alt={`${card.id} media ${card.id === "#1" ? i + 2 : i + 1}`}
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

      {showGraphic1Modal ? (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/55 px-4 py-8">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-auto rounded-3xl bg-white p-4 shadow-2xl md:p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-neutral-900">EZ as 1, 2, 3?</h3>
              <button
                type="button"
                onClick={() => setShowGraphic1Modal(false)}
                className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Close
              </button>
            </div>
            <Graphic1Module />
          </div>
        </div>
      ) : null}

      {showGraphic2Modal ? (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/55 px-4 py-8">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-auto rounded-3xl bg-white p-4 shadow-2xl md:p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-neutral-900">Every Client Has a Plus One</h3>
              <button
                type="button"
                onClick={() => setShowGraphic2Modal(false)}
                className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Close
              </button>
            </div>
            <Graphic2Module />
          </div>
        </div>
      ) : null}
    </>
  );
}
