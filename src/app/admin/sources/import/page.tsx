import Link from "next/link";
import BuildPageClient from "@/components/admin/pipeline/BuildPageClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import · Sources" };

export default function ImportPage() {
  return <div className="space-y-4">
    <Link href="/admin/sources" className="text-sm text-slate-600 hover:underline">← Sources</Link>
    <BuildPageClient />
  </div>;
}
