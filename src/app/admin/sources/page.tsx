import Link from "next/link";

export const metadata = { title: "Sources · Admin" };

const maintenance = [
  { href: "/admin/sources/history", title: "Intake history", description: "Read past submissions, their parsed-candidate counts, and processing summaries." },
  { href: "/admin/sola-containers", title: "Sola locations", description: "Maintain location sources and tenant extraction." },
  { href: "/admin/validate", title: "Submission review", description: "Inspect pending evidence and resolve source review tasks." },
  { href: "/admin/tools/data", title: "Processing diagnostics", description: "Inspect processing coverage, source drift, and recent pipeline actions." },
];

export default function SourcesPage() {
  return <div className="mx-auto max-w-6xl space-y-6">
    <div>
      <h1 className="text-2xl font-bold">Sources</h1>
      <p className="mt-1 text-sm text-slate-600">Bring in prospects and maintain the evidence behind them.</p>
    </div>
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div><h2 className="text-lg font-semibold">Import prospects</h2><p className="mt-1 text-sm text-slate-600">Paste a URL, Instagram text, DORA records, or a bulk upload.</p></div>
      <Link href="/admin/sources/import" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Import</Link>
    </section>
    <section>
      <h2 className="text-lg font-semibold">Source maintenance</h2>
      <p className="mt-1 text-sm text-slate-600">Source history and supported maintenance tools. Import a URL to collect source material; refresh an individual prospect from its details.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {maintenance.map((item) => <Link key={item.href} href={item.href} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400">
          <h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-sm text-slate-600">{item.description}</p>
        </Link>)}
      </div>
    </section>
  </div>;
}
