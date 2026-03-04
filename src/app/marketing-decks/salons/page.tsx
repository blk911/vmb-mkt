import type { Metadata } from "next";
import DeckTopNav from "../_components/DeckTopNav";
import MoneyShotsCards from "../money-shots/MoneyShotsCards";

export const metadata: Metadata = {
  title: "Marketing Decks - For Salons",
};

export default function SalonsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <DeckTopNav active="salons" />
      <section className="mx-auto max-w-5xl px-4 pt-10">
        <div className="grid gap-4 rounded-3xl border bg-white p-7 shadow-sm md:grid-cols-[minmax(0,1fr)_300px] md:p-10">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">VMB Salon Secret Sauce</h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-700 md:text-base">
              Salon owners know the moment: a new client sits down and says,{" "}
              <strong>"My friend told me I had to come see you."</strong> Your best clients bring the best clients,
              and they are more valuable than any ad campaign. Personal care has always run on relationships and word
              of mouth.
              <br />
              <br />
              But there has never been a system built around that truth. VMB changes that by turning clients into an
              engaged network that invites, gifts, shares, and promotes the salon they already love.
              <br />
              <br />
              <strong>Real growth is not more ads - it is activating clients to spread the word.</strong>
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-neutral-200">
            <img
              src="/moneyshothero2.jpg"
              alt="VMB Salon Secret Sauce hero"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>
      <MoneyShotsCards />
    </main>
  );
}
