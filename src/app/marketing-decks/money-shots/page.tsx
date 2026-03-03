import type { Metadata } from "next";
import DeckTopNav from "../_components/DeckTopNav";
import MoneyShotsCards from "./MoneyShotsCards";

export const metadata: Metadata = {
  title: "Marketing Decks - Money Shots",
};

export default function MoneyShotsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <DeckTopNav active="money" />
      <section className="mx-auto max-w-5xl px-4 pt-10">
        <div className="grid gap-4 rounded-3xl border bg-white p-7 shadow-sm md:grid-cols-[minmax(0,1fr)_300px] md:p-10">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">VMB Salon Secret Sauce</h1>
            <p className="mt-2 text-sm text-neutral-600 md:text-base">
              Hint: Success is about connections, relationshps and leveraging your time.
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
