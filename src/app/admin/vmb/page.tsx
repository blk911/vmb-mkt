import Link from "next/link";

export default function VmbAdminHome() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-black">VMB Admin</h1>
      <p className="mt-2 opacity-70">
        Data rollups, targeting, and materialization.
      </p>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/admin/vmb/rollups" className="p-4 border rounded-xl font-bold hover:bg-neutral-50">
          Rollups →
        </Link>
        <Link href="/admin/vmb/targets" className="p-4 border rounded-xl font-bold hover:bg-neutral-50">
          Targets →
        </Link>
        <Link href="/admin/vmb/facilities/import" className="p-4 border rounded-xl font-bold hover:bg-neutral-50">
          Facilities Import →
        </Link>
        <Link href="/admin/vmb/places/review" className="p-4 border rounded-xl font-bold hover:bg-neutral-50">
          Places Review →
        </Link>
        <Link href="/admin/vmb/places/sweep" className="p-4 border rounded-xl font-bold hover:bg-neutral-50">
          Places Sweep →
        </Link>
        <Link href="/admin/vmb/materialize" className="p-4 border rounded-xl font-bold hover:bg-neutral-50">
          Materialize →
        </Link>
      </div>
    </div>
  );
}
