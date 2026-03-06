import type { Metadata } from "next";
import DeckTopNav from "../_components/DeckTopNav";

export const metadata: Metadata = {
  title: "Marketing Decks - FAQ",
};

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <DeckTopNav active="faq" />
      <section className="mx-auto max-w-5xl px-4 pt-10 pb-16">
        <div className="rounded-3xl border bg-white p-7 shadow-sm md:p-10">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">FAQ</h1>
          <div className="mt-6 rounded-2xl border bg-neutral-50 px-6 py-5 text-lg font-semibold text-neutral-900">
            Coming soon
          </div>
        </div>
      </section>
    </main>
  );
}
