import type { Metadata } from "next";
import DeckTopNav from "./_components/DeckTopNav";
import BeUnforgettable from "@/components/BeUnforgettable";

export const metadata: Metadata = {
  title: "Marketing Decks",
};

export default function MarketingDecksPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <DeckTopNav active="home" />
      <section className="mx-auto max-w-4xl px-4 pt-10">
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
      </section>

      <section className="mt-6 w-full pb-16">
        <div className="mx-auto max-w-4xl px-4">
          <BeUnforgettable mode="light" loop speed="slow" />
        </div>
      </section>
    </main>
  );
}
