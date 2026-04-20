import PipelineNav from "@/components/admin/PipelineNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <PipelineNav />
      <div className="p-6">{children}</div>
    </div>
  );
}
