import Link from "next/link";
import { getAdminDashboardMetrics } from "@/lib/admin/pipeline/dashboard";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const metrics = await getAdminDashboardMetrics();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">Live counts from the current intake, queue, resolver, and outreach runtime artifacts.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="New Inputs" value={metrics.newInputs} />
        <StatCard title="Pending Validation" value={metrics.pendingValidation} />
        <StatCard title="Ready Targets" value={metrics.readyTargets} />
        <StatCard title="Active Outreach" value={metrics.activeOutreach} />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Action Required</h2>
        <ul className="space-y-2">
          <li>
            <ActionItem text={`${metrics.pendingValidation} operators need validation`} href="/admin/validate" />
          </li>
          <li>
            <ActionItem text={`${metrics.readyTargets} targets ready for outreach`} href="/admin/target" />
          </li>
          <li>
            <ActionItem text={`${metrics.activeOutreach} targets queued for activation`} href="/admin/activate" />
          </li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function ActionItem({ text, href }: { text: string; href: string }) {
  return (
    <Link href={href} className="block rounded-lg bg-white p-3 shadow hover:bg-gray-100">
      {text}
    </Link>
  );
}
