import { AdminSectionCards } from "@/components/admin/AdminSectionCards";
import { AdminTopNav } from "@/components/admin/AdminTopNav";
import { getAdminNavGroups } from "@/lib/admin/admin-nav";

export default function AdminPage() {
  // /admin is the canonical entry point for admin/operator tooling across the platform.
  const groups = getAdminNavGroups();

  return (
    <main className="min-h-screen bg-neutral-50">
      <AdminTopNav />
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-neutral-950">Admin Home</h1>
          <p className="mt-2 max-w-3xl text-sm text-neutral-600">
            Navigate admin tooling by operator workflow: platform, markets, operators, prospecting, intake, and data.
          </p>
        </div>

        <AdminSectionCards groups={groups} />
      </div>
    </main>
  );
}
