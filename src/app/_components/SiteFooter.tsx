import Link from "next/link";

const footerYear = new Date().getFullYear();

export default function SiteFooter() {
  return (
    <footer
      className="flex h-[100px] min-h-[100px] shrink-0 flex-col items-center justify-center gap-2 border-t border-neutral-200 bg-neutral-50 px-4 text-center text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950/80 dark:text-neutral-400"
      role="contentinfo"
    >
      <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
        © {footerYear} VenMeBaby · All rights reserved
      </p>
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-semibold uppercase tracking-wide">
        <Link href="/privacy" className="text-sky-700 underline-offset-2 hover:underline dark:text-sky-400">
          Privacy
        </Link>
        <span className="text-neutral-300 dark:text-neutral-600" aria-hidden>
          ·
        </span>
        <Link href="/terms" className="text-sky-700 underline-offset-2 hover:underline dark:text-sky-400">
          Terms
        </Link>
        <span className="text-neutral-300 dark:text-neutral-600" aria-hidden>
          ·
        </span>
        <a
          href="https://vmbsalons.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
        >
          VMB Salons
        </a>
        <span className="text-neutral-300 dark:text-neutral-600" aria-hidden>
          ·
        </span>
        <a href="mailto:support@vmbsalons.com" className="text-sky-700 underline-offset-2 hover:underline dark:text-sky-400">
          Contact
        </a>
      </nav>
    </footer>
  );
}
