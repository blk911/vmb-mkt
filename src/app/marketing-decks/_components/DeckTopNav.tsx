import Link from "next/link";

type TabKey = "home" | "salons" | "clients" | "details" | "faq";

function tabClass(active: boolean) {
  return active
    ? "text-sm font-semibold text-neutral-900"
    : "text-sm font-semibold text-neutral-500 hover:text-neutral-800";
}

export default function DeckTopNav({ active }: { active: TabKey }) {
  return (
    <div className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto grid max-w-[1100px] grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3">
        <Link href="/marketing-decks" className="min-w-0 text-sm font-semibold text-neutral-900">
          Marketing
        </Link>
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span className="text-sm font-semibold text-neutral-500">Quick Links:</span>
          <Link
            href="https://venmebaby.com"
            target="_blank"
            rel="noreferrer"
            className={tabClass(false)}
          >
            VMB Website
          </Link>
          <span className="text-neutral-300">:</span>
          <Link href="/marketing-decks/salons" className={tabClass(active === "salons")}>
            For Salons
          </Link>
          <span className="text-neutral-300">:</span>
          <Link href="/marketing-decks/clients" className={tabClass(active === "clients")}>
            For Clients
          </Link>
          <span className="text-neutral-300">:</span>
          <Link href="/marketing-decks/details" className={tabClass(active === "details")}>
            About
          </Link>
          <span className="text-neutral-300">:</span>
          <Link href="/marketing-decks/faq" className={tabClass(active === "faq")}>
            FAQ
          </Link>
        </div>
        <Link
          href="https://vmbsalons.com"
          target="_blank"
          rel="noreferrer"
          className="justify-self-end text-sm font-semibold text-neutral-900 hover:text-neutral-700"
        >
          VMB Salons
        </Link>
      </div>
    </div>
  );
}
