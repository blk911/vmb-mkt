"use client";

import Image from "next/image";
import { useState } from "react";
import SalonCashFlowComparison from "@/components/marketing/SalonCashFlowComparison";

const CARDS = [
  "#1 VMB's Mission Statement",
  "#2 The VMB Game Plan",
  "#3 VMB Co-Marketing Program",
  "#4 What's Next...",
  "#5 VMB in 30 Seconds",
];

const MISSION_TEXT =
  "The personal care industry is built on Clients and Client relationships. Our mission is to strengthen the connection between salons and their clients - by rewarding loyalty, encouraging referrals, and turning everyday relationships into lasting opportunity. VMB focuses on what actually drives growth: clients.";
const GAME_PLAN_TITLE = "VMB 2026 Rollout Plan";
const VMB_30S_GRAPHICS = [
  {
    src: "/Beauty and wellness at VMB Salon.png",
    alt: "Beauty and wellness at VMB Salon",
  },
  {
    src: "/How salons attract new clients.png",
    alt: "How salons attract new clients loop",
  },
  {
    src: "/How clients can boost your business.png",
    alt: "How clients help your salon grow",
  },
  {
    src: "/Building your VMB Referral Network.png",
    alt: "VMB referral network explainer",
  },
  {
    src: "/Beauty services connection in soft pink.png",
    alt: "Beauty services connection visual",
  },
  {
    src: "/Mother’s Day pampering with VMB gift cards.png",
    alt: "Mother's Day pampering with VMB gift cards",
  },
  {
    src: "/Let him spoil her with VMB.png",
    alt: "Let him spoil her with VMB",
  },
];

export default function DetailsCards() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  function toggle(idx: number) {
    setOpenIdx((prev) => (prev === idx ? null : idx));
  }

  return (
    <div className="mx-auto mt-8 max-w-5xl space-y-4 px-4 pb-16">
      {CARDS.map((title, idx) => {
        const open = openIdx === idx;
        return (
          <div key={title} className="rounded-2xl border bg-white shadow-sm">
            <button
              type="button"
              onClick={() => toggle(idx)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <span className="text-lg font-semibold text-neutral-900 md:text-xl">{title}</span>
              <span className="text-sm font-medium text-neutral-500">{open ? "Close" : "Open"}</span>
            </button>
            {open ? (
              <div className="border-t px-5 py-4 text-sm leading-relaxed text-neutral-600 md:text-base">
                {idx === 0 ? (
                  <p>
                    <span className="font-semibold text-neutral-900">MISSION:</span> {MISSION_TEXT}
                  </p>
                ) : idx === 1 ? (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xl font-semibold text-neutral-900">{GAME_PLAN_TITLE}</h3>
                      <p className="mt-3">
                        VMB is launching with a focused rollout designed to introduce the platform to real salons and
                        clients before expanding nationwide. The personal care industry has always grown through
                        relationships, referrals, and word-of-mouth recommendations, yet most tools available to
                        salons focus only on booking and payments.
                      </p>
                      <p className="mt-3">
                        VMB introduces a different approach - activating client networks through invitations, gifting,
                        and co-marketing participation that rewards both salons and their loyal clients.
                      </p>
                      <p className="mt-3">
                        Our rollout begins with a targeted launch in the Denver market, where early partner salons
                        will implement the platform and begin building strong client engagement. As adoption grows,
                        VMB expands into additional personal care services and opens new markets through a combination
                        of local marketing representatives and online registration.
                      </p>
                      <p className="mt-3">
                        This phased approach allows VMB to refine the experience, strengthen salon communities, and
                        build a growing client network across the broader personal care industry.
                      </p>
                    </div>

                    <div>
                      <h4 className="text-base font-semibold text-neutral-900">March 2026</h4>
                      <p className="mt-1">
                        <span className="font-medium text-neutral-900">MVP Launch - Denver Nail Salons</span>
                      </p>
                      <p className="mt-1">
                        VMB launches its MVP platform in select Denver-area nail salons. Early partners begin
                        introducing clients to invitations, gifting, and VMB&apos;s co-marketing features while helping
                        refine workflows and client engagement.
                      </p>
                    </div>

                    <div>
                      <h4 className="text-base font-semibold text-neutral-900">May 2026</h4>
                      <p className="mt-1">
                        <span className="font-medium text-neutral-900">Hair &amp; Styling Expansion</span>
                      </p>
                      <p className="mt-1">
                        VMB expands into the hair and styling markets and begins opening additional cities through
                        regional marketing representatives and online salon registration.
                      </p>
                    </div>

                    <div>
                      <h4 className="text-base font-semibold text-neutral-900">August 2026</h4>
                      <p className="mt-1">
                        <span className="font-medium text-neutral-900">Full Personal Care Platform</span>
                      </p>
                      <p className="mt-1">
                        Additional services are added including spa, brows, lips, waxing, and tanning. Online
                        registration opens broadly, allowing salons across all personal care segments to join the VMB
                        network.
                      </p>
                    </div>
                  </div>
                ) : idx === 2 ? (
                  <SalonCashFlowComparison />
                ) : idx === 3 ? (
                  <p className="font-semibold text-neutral-900">Coming Soon!!</p>
                ) : idx === 4 ? (
                  <div className="space-y-3">
                    <p className="font-semibold text-neutral-900">
                      VMB helps salons grow with the clients they already have.
                    </p>
                    <div className="space-y-4">
                      {VMB_30S_GRAPHICS.map((g) => (
                        <div key={g.src} className="overflow-hidden rounded-xl border bg-white">
                          <Image
                            src={g.src}
                            alt={g.alt}
                            width={1024}
                            height={1024}
                            className="h-auto w-full"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>Lorem ipsum content slot. Click card header again to close.</>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
