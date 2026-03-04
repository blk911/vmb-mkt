import type { Metadata } from "next";
import DeckTopNav from "./_components/DeckTopNav";

export const metadata: Metadata = {
  title: "Marketing Decks",
};

export default function MarketingDecksPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <DeckTopNav active="home" />
      <section className="mx-auto max-w-5xl px-4 pt-10 pb-16">
        <div className="rounded-3xl border bg-white p-7 shadow-sm md:p-10">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">MK DECKS</h1>
        </div>
      </section>
    </main>
  );
}
