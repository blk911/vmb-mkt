import type { Metadata } from "next";
import DeckTopNav from "../_components/DeckTopNav";
import DetailsCards from "./DetailsCards";

export const metadata: Metadata = {
  title: "Marketing Decks - Details",
};

export default function DetailsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <DeckTopNav active="details" />
      <section className="mx-auto max-w-5xl px-4 pt-10">
        <div className="rounded-3xl border bg-white p-7 shadow-sm md:p-10">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">Details</h1>
          <p className="mt-3 text-neutral-600">Click each card to open/close. Titles are ipsum placeholders for now.</p>
        </div>
      </section>
      <DetailsCards />
    </main>
  );
}
