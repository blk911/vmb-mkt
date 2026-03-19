import type { Metadata } from "next";
import DeckTopNav from "../_components/DeckTopNav";
import { Graphic1Module } from "@/components/vmb-faq/Graphic1Module";
import { Graphic2Module } from "@/components/vmb-faq/Graphic2Module";
import { Graphic3Module } from "@/components/vmb-faq/Graphic3Module";

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
          <p className="mt-3 max-w-3xl text-base leading-7 text-neutral-700">
            Explore the three VMB FAQ graphics below to see how salon client activation, plus-one growth,
            and co-marketing expansion work together.
          </p>
          <div className="mt-8 space-y-8">
            <Graphic1Module />
            <Graphic2Module />
            <Graphic3Module />
          </div>
        </div>
      </section>
    </main>
  );
}
