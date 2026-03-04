import Link from "next/link";

export default function MoneyShotCard() {
  return (
    <section className="w-full">
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 shadow-sm">
          <div className="flex min-h-[50px] items-center justify-between gap-4">
            <div className="text-sm font-semibold tracking-[0.18em] text-white/80">MONEY SHOTS</div>
            <div className="flex items-center gap-5 text-sm font-semibold tracking-wide">
              <Link
                href="/marketing-decks/salons"
                className="text-white/85 transition hover:text-white"
              >
                SALON
              </Link>
              <span className="text-white/30" aria-hidden>
                |
              </span>
              <Link
                href="/marketing-decks/clients"
                className="text-white/85 transition hover:text-white"
              >
                CLIENT
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
