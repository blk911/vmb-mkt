import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <section className="mx-auto flex min-h-[calc(100vh-56px)] max-w-6xl items-center px-4 py-12">
        <div className="grid w-full gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm md:p-10">
            <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              External Access
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-neutral-950 md:text-5xl">
              Welcome to VenMeBaby
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-700 md:text-lg">
              venmebaby.com is the secure product entry point for VMB. External visitors can learn where to go
              next, while internal operators can continue into the protected data, targeting, and review
              workflows.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center rounded-xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Secure Sign In
              </Link>
              <Link
                href="/access/request"
                className="inline-flex items-center justify-center rounded-xl border border-sky-300 bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-800 transition hover:border-sky-400 hover:bg-sky-100"
              >
                Request Access
              </Link>
              <a
                href="https://vmbsalons.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-neutral-300 px-5 py-3 text-sm font-semibold text-neutral-900 transition hover:border-neutral-400 hover:bg-neutral-50"
              >
                Visit Corporate Site
              </a>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-900">Internal Use</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-700">
                  Targets, sorting, market intelligence, queue reviews, and admin workflows remain available only
                  to authenticated VMB users.
                </p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-900">External Access</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-700">
                  Use this domain as the secure product front door. If you need access, coordinate with your VMB
                  administrator before signing in.
                </p>
              </div>
            </div>
          </div>

          <aside className="rounded-3xl border border-neutral-200 bg-neutral-950 p-8 text-white shadow-sm md:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">Platform Layout</p>
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-lg font-semibold">venmebaby.com</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-300">
                  Product entry, secure sign-in, and authenticated access to internal operator tooling.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-lg font-semibold">vmbsalons.com</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-300">
                  Corporate presence, broader messaging, and external-facing marketing handled outside the app.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
