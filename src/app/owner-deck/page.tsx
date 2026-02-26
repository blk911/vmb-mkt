import type { Metadata } from "next";
import BeUnforgettable from "@/components/BeUnforgettable";

export const metadata: Metadata = {
  title: "VMB - Owner Deck",
  description:
    "VMB turns salon booking into a revenue system: secured confirmation, premium appointments, loyalty, and co-marketing growth.",
};

type Card = {
  kicker?: string;
  title: string;
  bullets?: string[];
  summary?: [string, string];
};

function CardShell({ card, index }: { card: Card; index: number }) {
  return (
    <section className="w-full">
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-3xl border bg-white/80 p-7 shadow-sm backdrop-blur md:p-10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {card.kicker ? (
                <div className="mb-2 text-xs font-semibold tracking-widest text-neutral-500">
                  {card.kicker}
                </div>
              ) : null}

              <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
                {card.title}
              </h2>
            </div>

            <div className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white">
              {String(index + 1).padStart(2, "0")}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border bg-neutral-50 p-4">
            {index === 7 ? (
              <div className="grid grid-cols-4 gap-2">
                <img
                  src="/owner-deck-assets/van-tay-media-chyT9XPAdcg-unsplash.jpg"
                  alt="Owner deck visual strip 1"
                  className="h-24 w-full rounded-lg object-cover"
                />
                <img
                  src="/owner-deck-assets/blake-wisz-q3o_8MteFM0-unsplash.jpg"
                  alt="Owner deck visual strip 2"
                  className="h-24 w-full rounded-lg object-cover"
                />
                <img
                  src="/owner-deck-assets/elena-rabkina-QH8aF3B0gYQ-unsplash.jpg"
                  alt="Owner deck visual strip 3"
                  className="h-24 w-full rounded-lg object-cover"
                />
                <img
                  src="/owner-deck-assets/alexander-grey--8a5eJ1-mmQ-unsplash (1).jpg"
                  alt="Owner deck visual strip 4"
                  className="h-24 w-full rounded-lg object-cover"
                />
              </div>
            ) : index === 0 || index === 1 || index === 2 || index === 3 || index === 4 || index === 5 || index === 6 ? (
              <div className="grid grid-cols-2 gap-3">
                <img
                  src={
                    index === 0
                      ? "/owner-deck-assets/adem-ay-Tk9m_HP4rgQ-unsplash.jpg"
                      : index === 1
                        ? "/owner-deck-assets/or-hakim-0jR7w4OW5SQ-unsplash.jpg"
                        : index === 2
                          ? "/owner-deck-assets/simon-kadula--gkndM1GvSA-unsplash.jpg"
                          : index === 3
                            ? "/owner-deck-assets/melissa-askew-tSlvoSZK77c-unsplash.jpg"
                            : index === 4
                              ? "/owner-deck-assets/patrick-tomasso-fMntI8HAAB8-unsplash.jpg"
                              : index === 5
                                ? "/owner-deck-assets/kevin-laminto-plTEYtXwXok-unsplash.jpg"
                                : "/owner-deck-assets/alexander-grey--8a5eJ1-mmQ-unsplash.jpg"
                  }
                  alt="Owner deck visual left"
                  className="h-44 w-full rounded-xl object-cover"
                />
                <img
                  src={
                    index === 0
                      ? "/owner-deck-assets/simon-kadula--gkndM1GvSA-unsplash.jpg"
                      : index === 1
                        ? "/owner-deck-assets/giorgio-trovato-OKXwmdbdXkk-unsplash.jpg"
                        : index === 2
                          ? "/owner-deck-assets/towfiqu-barbhuiya-bwOAixLG0uc-unsplash.jpg"
                          : index === 3
                            ? "/owner-deck-assets/brooke-cagle-BMLPa7HBnQQ-unsplash.jpg"
                            : index === 4
                              ? "/owner-deck-assets/jodene-isakowitz-hvqHtZqNMeI-unsplash.jpg"
                              : index === 5
                                ? "/owner-deck-assets/jodene-isakowitz-hvqHtZqNMeI-unsplash.jpg"
                                : "/owner-deck-assets/imagine-buddy-vsLbaIdhwaU-unsplash.jpg"
                  }
                  alt="Owner deck visual right"
                  className="h-44 w-full rounded-xl object-cover"
                />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-neutral-700">Visual slot</div>
                  <div className="text-xs text-neutral-500">Drop icon / gif / lottie here</div>
                </div>
                <div className="mt-3 h-20 w-full rounded-xl border border-dashed bg-white" />
              </>
            )}
          </div>

          {card.bullets?.length ? (
            <ul className="mt-6 space-y-3 text-lg leading-relaxed text-neutral-800">
              {card.bullets.map((b, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="mt-2 inline-block h-2 w-2 flex-none rounded-full bg-neutral-900"
                    aria-hidden
                  />
                  <span className="min-w-0">{b}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {card.summary ? (
            <div className="mt-7 rounded-2xl bg-neutral-900 p-5 text-white">
              <div className="text-sm font-semibold tracking-wide opacity-90">Summary</div>
              <div className="mt-2 text-lg leading-relaxed">
                <div>{card.summary[0]}</div>
                <div className="opacity-90">{card.summary[1]}</div>
              </div>
            </div>
          ) : null}

        </div>
      </div>
    </section>
  );
}

export default function OwnerDeckPage() {
  const cards: Card[] = [
    {
      kicker: "VMB - Owner Deck",
      title: "Appointments Become Predictable Revenue",
      bullets: [
        "Secure time. Fill chairs. Grow revenue.",
        "Shift client behavior from casual bookings to committed appointments.",
        "Reward loyalty and referrals without manual admin work.",
      ],
      summary: [
        "VMB transforms bookings into committed revenue.",
        "It replaces uncertainty with stability.",
      ],
    },
    {
      kicker: "The Owner Problem",
      title: "Every Salon Loses Money the Same Way",
      bullets: [
        "Last-minute cancellations and no-shows.",
        "Empty chairs during peak hours that cannot be recovered.",
        "Unpredictable weekly revenue despite strong demand.",
        "Demand is not the issue - commitment is.",
      ],
      summary: ["This is a behavior problem, not a demand problem.", "VMB fixes behavior."],
    },
    {
      kicker: "The Shift",
      title: "From Casual Appointments -> Secured Time",
      bullets: [
        "Traditional booking = fragile revenue.",
        "VMB booking = confirmed commitment.",
        "Same salon, better client behavior.",
        "Predictable schedule and forecasting.",
      ],
      summary: ["You keep your workflow.", "Client behavior improves automatically."],
    },
    {
      kicker: "Core Mechanism",
      title: "Payment Secured at Appointment Confirmation",
      bullets: [
        "When clients confirm, payment is secured.",
        "Fewer no-shows and late cancels.",
        "Higher attendance and cleaner schedules.",
        "Revenue visibility improves immediately.",
      ],
      summary: ["Not a deposit.", "A commitment."],
    },
    {
      kicker: "Premium Strategy",
      title: "Protect Peak Hours With Preferred Booking",
      bullets: [
        "Priority booking access for VMB members.",
        "Peak slots go to your best clients.",
        "Clear segmentation: VIP vs casual.",
        "Higher revenue per hour over time.",
      ],
      summary: [
        "Your best time slots go to your best clients.",
        "Premium access drives premium behavior.",
      ],
    },
    {
      kicker: "Retention Engine",
      title: "Outbound Loyalty Program That Recruits",
      bullets: [
        "Incentivized rebooking (repeat behavior).",
        "Rewards participation (clients stay engaged).",
        "Referral participation (clients recruit).",
        "Less manual follow-up from staff.",
      ],
      summary: ["Retention becomes a system.", "Not a staff task."],
    },
    {
      kicker: "Growth Engine",
      title: "Co-Marketing Program That Compounds",
      bullets: [
        "Clients promote the salon to friends and family.",
        "Reward-based referrals reduce ad spend.",
        "Owners participate in a shared growth network.",
        "Optional: sponsor other salons and expand reach.",
      ],
      summary: ["Clients become promoters.", "Growth becomes organic."],
    },
    {
      kicker: "Owner Close",
      title: "What VMB Delivers for You",
      bullets: [
        "Reduced cancellations with secured confirmation.",
        "Premium appointments: priority booking for VMB members.",
        "Outbound loyalty program that drives rebooking + recruiting.",
        "Co-marketing participation (and optional salon sponsorship) for compounding growth.",
      ],
      summary: [
        "VMB strengthens your schedule, your revenue, and your client base.",
        "It turns booking into a structured growth system.",
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <div className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-neutral-900">VMB</div>
            <div className="text-xs text-neutral-500">Owner Deck (Web)</div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 pt-10">
        <div className="rounded-3xl border bg-white p-7 shadow-sm md:p-10">
          <div className="flex justify-center pt-2">
            <img
              src="/owner-deck-assets/vmb-logo.png"
              alt="VMB logo"
              className="h-20 w-auto rounded-md"
            />
          </div>
          <h1 className="mt-3 text-center text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">
            The Modern Revenue System for Salons
          </h1>
          <ul className="mt-4 space-y-1 text-center text-2xl font-semibold leading-tight text-neutral-900 md:text-3xl">
            <li>Eliminate Cancellations</li>
            <li>Protect Peak Hours</li>
            <li>Client Loyalty = Retention</li>
            <li>Monetize Referrals</li>
          </ul>
        </div>
      </div>

      <section className="mt-6 w-full">
        <div className="mx-auto max-w-4xl px-4">
          <BeUnforgettable mode="dark" loop={false} speed="slow" />
        </div>
      </section>

      <div id="cards" className="mt-10 space-y-6 pb-16 md:space-y-8">
        {cards.map((card, idx) => (
          <CardShell key={idx} card={card} index={idx} />
        ))}
      </div>

      <footer className="border-t bg-white">
        <div className="mx-auto max-w-4xl px-4 py-8 text-sm text-neutral-600">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>© {new Date().getFullYear()} VMB</div>
            <div className="flex gap-4">
              <a className="hover:underline" href="/owner-deck">
                Owner Deck
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
