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
          <p className="mx-auto mt-4 max-w-3xl text-center text-lg leading-relaxed text-neutral-700 md:text-xl">
            The personal care industry is built on Clients and Client relationships. Our mission is to
            strengthen the connection between salons and their clients - by rewarding loyalty, encouraging
            referrals, and turning everyday relationships into lasting opportunity.
            <br />
            <span className="text-neutral-900">
              VMB focuses on what drives revenue and growth:{" "}
              <strong className="font-semibold">CLIENTS.</strong>
            </span>
          </p>
        </div>
      </section>

      <section className="mt-6 w-full pb-16">
        <div className="mx-auto max-w-4xl px-4">
          <BeUnforgettable mode="light" loop speed="slow" />
        </div>
      </section>

      <section className="-mt-8 w-full pb-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex h-full justify-center rounded-3xl border bg-white p-4 shadow-sm">
              <img
                src="/door-sticker3.webp"
                alt="VMB promotional sticker"
                className="h-auto w-full rounded-2xl"
              />
            </div>
            <div className="flex h-full justify-center rounded-3xl border bg-white p-4 shadow-sm">
              <img
                src="/door-sticker3.png"
                alt="VMB external locations sticker"
                className="h-auto w-full rounded-2xl"
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
