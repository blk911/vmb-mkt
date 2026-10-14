import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { canAccessAdmin, getSessionUserFromCookies } from "@/lib/auth/access";
import ReviewExportDownload from "@/components/admin/ReviewExportDownload";

export const dynamic = "force-dynamic";

export default async function ReviewExportPage() {
  const user = await getSessionUserFromCookies(await cookies());
  if (!user) redirect("/auth/login?next=%2Fadmin%2Freview-export");
  if (!canAccessAdmin(user)) redirect("/admin/markets");
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-bold">Review export</h1>
      <ReviewExportDownload />
    </div>
  );
}
