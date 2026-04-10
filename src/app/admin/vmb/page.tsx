import Link from "next/link";
import { AdminTopNav } from "@/components/admin/AdminTopNav";
import VmbClusterExplorer from "@/components/vmb/vmb-cluster-explorer";
import { DEMO_CLUSTER_ENTITIES } from "@/lib/cluster/demo-entities";

export default function VmbAdminHome() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <AdminTopNav />
      <div className="p-6">
        <h1 className="text-2xl font-black text-neutral-900">VMB Admin</h1>
        <p className="mt-2 text-neutral-600">VMB-specific review, rollup, and intake tooling inside the broader admin system.</p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link href="/admin/vmb/rollups" className="rounded-xl border border-neutral-200 bg-white p-4 font-bold hover:bg-neutral-50">
            Rollups →
          </Link>
          <Link href="/admin/dora/targets" className="rounded-xl border border-neutral-200 bg-white p-4 font-bold hover:bg-neutral-50">
            DORA Targets →
          </Link>
          <Link href="/admin/vmb/facilities/import" className="rounded-xl border border-neutral-200 bg-white p-4 font-bold hover:bg-neutral-50">
            Facilities Import →
          </Link>
          <Link href="/admin/vmb/places/review" className="rounded-xl border border-neutral-200 bg-white p-4 font-bold hover:bg-neutral-50">
            Places Review →
          </Link>
          <Link href="/admin/vmb/places/sweep" className="rounded-xl border border-neutral-200 bg-white p-4 font-bold hover:bg-neutral-50">
            Places Sweep →
          </Link>
          <Link href="/admin/vmb/tech" className="rounded-xl border border-neutral-200 bg-white p-4 font-bold hover:bg-neutral-50">
            Tech →
          </Link>
          <Link
            href="/admin/manual-ig-clusters"
            className="block rounded-lg border border-neutral-200 bg-white p-4 hover:bg-gray-50"
          >
            <div className="font-medium">IG Clusters →</div>
            <div className="text-sm text-gray-500">
              Manual Instagram network intake and review
            </div>
          </Link>
        </div>

        <div className="mt-10">
          <VmbClusterExplorer data={DEMO_CLUSTER_ENTITIES} />
        </div>
      </div>
    </main>
  );
}
