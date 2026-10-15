import Link from "next/link";

export const metadata = { title: "Admin tools" };

const tools = [
  { href: "/admin/tools/overview", title: "Runtime counts", description: "Intake submissions, pending review tasks, approved providers, and saved outreach queue rows." },
  { href: "/admin/tools/data", title: "Data diagnostics", description: "Canonical pipeline state, reconciliation, recent actions, and processing coverage." },
  { href: "/admin/validate", title: "Detailed review queue", description: "Submission-scoped review and advanced resolution actions." },
  { href: "/team", title: "Team and access", description: "Open the Team app to manage your team and access." },
  { href: "/admin/activate", title: "Outreach connection status", description: "Check preparation status and what is currently connected." },
];

const legacyTools = [
  { href: "/admin/markets", title: "Legacy Markets", description: "Inspect the earlier geographic market view, zone coverage, and source artifacts." },
  { href: "/admin/live-units", title: "Legacy Live Units", description: "Inspect earlier live-unit datasets, review decisions, and shop-to-technician associations." },
];

export default function ToolsPage() {
  return <div className="mx-auto max-w-5xl space-y-5">
    <div><h1 className="text-2xl font-bold">Admin tools</h1><p className="mt-1 text-sm text-slate-600">Diagnostics, advanced review, and access management.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">{tools.map((item) => <Link href={item.href} key={item.href} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400">
      <h2 className="font-semibold">{item.title}</h2><p className="mt-1 text-sm text-slate-600">{item.description}</p>
    </Link>)}</div>
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Legacy market tools</h2>
      <p className="text-sm text-slate-600">Retained for diagnostics and earlier workflows. These views use separate datasets and may include sample-derived signals. Use Prospects and Sources for the current shared workflow.</p>
      <div className="grid gap-3 sm:grid-cols-2">{legacyTools.map((item) => <Link href={item.href} key={item.href} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400">
        <h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-sm text-slate-600">{item.description}</p>
      </Link>)}</div>
    </section>
  </div>;
}
