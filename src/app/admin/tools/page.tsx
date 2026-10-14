import Link from "next/link";

export const metadata = { title: "Admin tools" };

const tools = [
  { href: "/admin/tools/overview", title: "Runtime counts", description: "Intake submissions, pending review tasks, approved providers, and saved outreach queue rows." },
  { href: "/admin/tools/data", title: "Data diagnostics", description: "Canonical pipeline state, reconciliation, recent actions, and processing coverage." },
  { href: "/admin/validate", title: "Detailed review queue", description: "Submission-scoped review and advanced resolution actions." },
  { href: "/team", title: "Team and access", description: "Open the Team app to manage your team and access." },
  { href: "/admin/activate", title: "Outreach connection status", description: "Check preparation status and what is currently connected." },
];

export default function ToolsPage() {
  return <div className="mx-auto max-w-5xl space-y-5">
    <div><h1 className="text-2xl font-bold">Admin tools</h1><p className="mt-1 text-sm text-slate-600">Diagnostics, advanced review, and access management.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">{tools.map((item) => <Link href={item.href} key={item.href} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400">
      <h2 className="font-semibold">{item.title}</h2><p className="mt-1 text-sm text-slate-600">{item.description}</p>
    </Link>)}</div>
  </div>;
}
