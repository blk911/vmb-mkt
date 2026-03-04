import type { Metadata } from "next";
import DeckTopNav from "../_components/DeckTopNav";
import ClientsCards from "./ClientsCards";

export const metadata: Metadata = {
  title: "Marketing Decks - For Clients",
};

export default function ClientsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <DeckTopNav active="clients" />
      <section className="mx-auto max-w-5xl px-4 pt-10">
        <div className="grid gap-4 rounded-3xl border bg-white p-7 shadow-sm md:grid-cols-[minmax(0,1fr)_300px] md:p-10">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">
              VMB: Client Loyalty is Priceless
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-neutral-700 md:text-base">
              Think about it: Hair. Nails. Skin. Brows. Someone always notices you. Your friend asks, "Where did you
              get that done?" A coworker leans, a comment pops up on Instagram: "Your hair looks amazing." "Who does
              your nails?"
              <br />
              <br />
              These moments bring <strong>a smile, you know the feeling!</strong>
              <br />
              <br />
              <strong>YOU are how great salons grow - through sharing
              what you love.</strong> VMB makes those connections happen seamlessly. Invite friends. Send salon service
              gifts.
              <br />
              <br />
              <strong>Unlock VMB's co-marketing rewards program.</strong> Your great style is meant to be shared.
            </p>
          </div>
          <div className="flex items-center justify-center">
            <img
              src="/forclientsh2.png"
              alt="For Clients hero"
              className="h-[90%] w-[90%] object-contain"
            />
          </div>
        </div>
      </section>
      <ClientsCards />
    </main>
  );
}
