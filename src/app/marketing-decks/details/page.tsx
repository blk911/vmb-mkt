import type { Metadata } from "next";
import Link from "next/link";
import DeckTopNav from "../_components/DeckTopNav";
import DetailsCards from "./DetailsCards";

export const metadata: Metadata = {
  title: "Marketing Decks - Details",
};

export default function DetailsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <DeckTopNav active="details" />
      <section className="mx-auto max-w-5xl px-4 pt-6">
        <div className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 shadow-sm">
          <div className="flex min-h-[50px] items-center justify-between gap-4">
            <div className="text-sm font-semibold tracking-[0.18em] text-white/80">DETAILS</div>
            <div className="flex items-center gap-5 text-sm font-semibold tracking-wide">
              <Link href="/marketing-decks/details" className="text-white/85 transition hover:text-white">
                DETAILS
              </Link>
              <span className="text-white/30" aria-hidden>
                |
              </span>
              <Link href="/owner-deck" className="text-white/85 transition hover:text-white">
                MODERN REV
              </Link>
            </div>
          </div>
        </div>
      </section>
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
