"use client";

import Image from "next/image";

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
    src: "/Mother's Day beauty salon gift guide.png",
    alt: "Mother's Day beauty salon gift guide",
  },
  {
    src: "/Let him spoil her with VMB.png",
    alt: "Let him spoil her with VMB",
  },
];

const VMB_30S_INSERTS = [
  "USE VMB to build your exclusive, invite-only client network",
  "Client invitations are your leverage - no ad spend required",
  "Clients build relationships - they don't buy services",
  "Clients choose on trust - they ask their friends first",
  "When it's great, clients tell, share, and post",
  "VMB Gift Requests turn sharing into bookings and new clients",
  "You don't chase clients - your network brings them to you",
];

type Props = {
  showEmailButton?: boolean;
};

export default function VmbThirtySecondsContent({ showEmailButton = false }: Props) {
  return (
    <div className="space-y-4">
      <p className="font-semibold text-neutral-900">VMB helps salons grow with the clients they already have.</p>
      <div className="space-y-4">
        {VMB_30S_GRAPHICS.map((graphic, index) => (
          <div key={graphic.src} className="space-y-4">
            <div className="overflow-hidden rounded-xl border bg-white">
              <Image src={graphic.src} alt={graphic.alt} width={1024} height={1024} className="h-auto w-full" />
            </div>
            <p className="font-semibold text-neutral-900">{VMB_30S_INSERTS[index]}</p>
          </div>
        ))}
      </div>
      {showEmailButton ? (
        <div className="pt-2">
          <a
            href="https://www.vmbsalons.com/access/request"
            className="inline-flex items-center justify-center rounded-xl border border-sky-300 bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-800 transition hover:border-sky-400 hover:bg-sky-100"
          >
            More Info Email
          </a>
        </div>
      ) : null}
    </div>
  );
}
