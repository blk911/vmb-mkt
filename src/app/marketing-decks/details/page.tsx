import type { Metadata } from "next";
import DeckTopNav from "../_components/DeckTopNav";
import DetailsCards from "./DetailsCards";

export const metadata: Metadata = {
  title: "Marketing Decks - About",
};

export default function DetailsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <DeckTopNav active="details" />
      <section className="mx-auto max-w-5xl px-4 pt-10">
        <div className="rounded-3xl border bg-white p-7 shadow-sm md:p-10">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">About VMB Salons</h1>
          <p className="mt-3 text-xl font-bold leading-8 text-neutral-900 md:text-2xl">
            VMB is a client-activation platform that turns salon clients into a growth engine for referrals,
            loyalty, and new revenue.
          </p>
        </div>
      </section>
      <DetailsCards />
    </main>
  );
}
