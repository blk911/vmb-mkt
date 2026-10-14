import Link from "next/link";
import { getAdminDashboardMetrics } from "@/lib/admin/pipeline/dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Runtime counts · Admin tools" };

export default async function RuntimeOverviewPage() {
  const metrics = await getAdminDashboardMetrics();
  const cards = [
    { label: "Intake submissions", value: metrics.newInputs, href: "/admin/sources/history" },
    { label: "Pending review tasks", value: metrics.pendingValidation, href: "/admin/validate" },
    { label: "Approved providers", value: metrics.readyTargets, href: "/admin/prospects?reviewStatus=approved" },
    { label: "Outreach queue rows", value: metrics.activeOutreach, href: "/admin/activate" },
  ];
  return <div className="space-y-5">
    <Link href="/admin/tools" className="text-sm text-slate-600 hover:underline">← Admin tools</Link>
    <div><h1 className="text-2xl font-bold">Runtime counts</h1><p className="mt-1 text-sm text-slate-600">Counts from intake, review tasks, approved providers, and the saved outreach queue.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <Link href={card.href} key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400">
      <div className="text-sm text-slate-600">{card.label}</div><div className="mt-1 text-2xl font-bold">{card.value}</div>
    </Link>)}</div>
    <p className="text-sm text-slate-600">A prospect can have multiple review tasks. Approval does not establish outreach eligibility. Queue rows do not represent active or sent campaigns.</p>
  </div>;
}
