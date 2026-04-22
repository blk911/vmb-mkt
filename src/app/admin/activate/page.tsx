import { redirect } from "next/navigation";
import NextActionLink from "@/components/admin/pipeline/NextActionLink";
import { appendAdminAction } from "@/lib/admin/pipeline/logging";
import { listOutreachQueue } from "@/lib/admin/pipeline/outreach-queue";

export const dynamic = "force-dynamic";

export default async function ActivatePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  const rows = await listOutreachQueue();
  const notice = typeof params.notice === "string" ? params.notice : undefined;

  async function sendCampaign(formData: FormData) {
    "use server";

    const template = String(formData.get("template") || "").trim();
    await appendAdminAction({
      action: "activate_send_campaign",
      entityType: "outreach_queue",
      entityId: "current",
      result: "success",
      details: {
        queueSize: rows.length,
        templatePreview: template.slice(0, 180),
      },
    });
    redirect("/admin/activate?notice=campaign_logged");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Outreach</h1>
        <p className="mt-1 text-sm text-gray-600">Queued targets come from the persisted runtime outreach queue.</p>
      </div>

      {notice ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div> : null}

      <div className="rounded-xl bg-white p-4 shadow">
        <h2 className="font-semibold">Queued Targets</h2>
        <div className="mt-4 overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Priority</th>
                <th className="p-3">City</th>
                <th className="p-3">Category</th>
                <th className="p-3">IG</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row) => (
                  <tr key={row.operatorId} className="border-t">
                    <td className="p-3 font-medium">{row.name}</td>
                    <td className="p-3">{row.priority}</td>
                    <td className="p-3">{row.city || "Unknown"}</td>
                    <td className="p-3">{row.category || "Unknown"}</td>
                    <td className="p-3">{row.ig ? "Yes" : "No"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-4 text-gray-500" colSpan={5}>
                    No queued outreach targets yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <form action={sendCampaign} className="rounded-xl bg-white p-4 shadow">
        <h2 className="font-semibold">Message Template</h2>
        <textarea
          className="mt-3 h-32 w-full rounded border p-2"
          defaultValue="Hi {{name}}, we found your business through the VMB pipeline and would like to connect."
          name="template"
        />
        <button className="mt-3 rounded bg-black px-4 py-2 text-white" type="submit">
          Send Campaign
        </button>
      </form>

      <NextActionLink href="/admin" text="Check dashboard counts after outreach updates" />
    </div>
  );
}
