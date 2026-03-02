import Link from "next/link";

type TabKey = "modern" | "money" | "details";

function tabClass(active: boolean) {
  return active
    ? "rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white"
    : "rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100";
}

export default function DeckTopNav({ active }: { active: TabKey }) {
  return (
    <div className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-neutral-900">Marketing Decks</div>
          <div className="text-xs text-neutral-500">Tab Navigation</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/owner-deck" className={tabClass(active === "modern")}>
            Modern Rev Sys
          </Link>
          <Link href="/marketing-decks/money-shots" className={tabClass(active === "money")}>
            Money Shots
          </Link>
          <Link href="/marketing-decks/details" className={tabClass(active === "details")}>
            Details
          </Link>
        </div>
      </div>
    </div>
  );
}
