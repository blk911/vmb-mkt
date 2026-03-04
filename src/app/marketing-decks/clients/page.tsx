import type { Metadata } from "next";
import DeckTopNav from "../_components/DeckTopNav";

export const metadata: Metadata = {
  title: "Marketing Decks - For Clients",
};

export default function ClientsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <DeckTopNav active="clients" />
      <section className="mx-auto max-w-5xl px-4 pt-10 pb-16">
        <div className="rounded-3xl border bg-white p-7 shadow-sm md:p-10">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">For Clients</h1>
          <p className="mt-3 text-neutral-600">Client page shell is ready for content.</p>
        </div>
      </section>
    </main>
  );
}
