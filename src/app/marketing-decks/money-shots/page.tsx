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
        <div className="rounded-3xl border bg-white p-7 shadow-sm md:p-10">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">Money Shots</h1>
          <p className="mt-2 text-sm text-neutral-600 md:text-base">
            Click each card to open/close. Title slots are placeholder ipsum for now.
          </p>
        </div>
      </section>
      <MoneyShotsCards />
    </main>
  );
}
