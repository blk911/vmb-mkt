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
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">About</h1>
          <p className="mt-3 text-neutral-600">
            <span className="font-semibold text-neutral-900">MISSION:</span> The personal care industry is built on
            Clients and Client relationships. Our mission is to strengthen the connection between salons and their
            clients - by rewarding loyalty, encouraging referrals, and turning everyday relationships into lasting
            opportunity. VMB focuses on what actually drives growth: clients.
          </p>
        </div>
      </section>
      <DetailsCards />
    </main>
  );
}
