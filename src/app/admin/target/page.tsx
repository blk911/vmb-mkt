import { redirect } from "next/navigation";
import NextActionLink from "@/components/admin/pipeline/NextActionLink";
import { appendAdminAction } from "@/lib/admin/pipeline/logging";
import { addOutreachQueueItem, listOutreachQueue } from "@/lib/admin/pipeline/outreach-queue";
import { filterTargetRows, getTargetFilterOptions, listTargetRows } from "@/lib/admin/pipeline/targeting";

export default async function TargetPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  const allRows = await listTargetRows();
  const filters = {
    city: typeof params.city === "string" ? params.city : "all",
    category: typeof params.category === "string" ? params.category : "all",
    ig: typeof params.ig === "string" ? params.ig : "all",
    confidence: typeof params.confidence === "string" ? params.confidence : "0",
  };
  const rows = filterTargetRows(allRows, filters);
  const options = getTargetFilterOptions(allRows);
  const outreachRows = await listOutreachQueue();
  const outreachIds = new Set(outreachRows.map((row) => row.operatorId));
  const notice = typeof params.notice === "string" ? params.notice : undefined;
  const readyCount = allRows.length;

  async function addToOutreach(formData: FormData) {
    "use server";

    const operatorId = String(formData.get("operatorId") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const ig = String(formData.get("ig") || "").trim() || undefined;
    const city = String(formData.get("city") || "").trim() || undefined;
    const category = String(formData.get("category") || "").trim() || undefined;
    const priority = String(formData.get("priority") || "normal").trim() || "normal";

    if (!operatorId || !name) {
      redirect("/admin/target?notice=missing_target_fields");
    }

    const result = await addOutreachQueueItem({ operatorId, name, ig, city, category, priority });
    await appendAdminAction({
      action: "target_add_to_outreach",
      entityType: "operator",
      entityId: operatorId,
      result: result.outcome === "already_exists" ? "noop" : "success",
      details: { name, ig, city, category, priority, outcome: result.outcome },
    });

    redirect(`/admin/target?notice=${encodeURIComponent(result.outcome)}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Target Operators</h1>
        <p className="mt-1 text-sm text-gray-600">Only approved validation outcomes are eligible for outreach selection.</p>
      </div>

      {notice ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {notice === "added" && "Added to outreach queue."}
          {notice === "updated" && "Outreach queue entry updated."}
          {notice === "already_exists" && "Item is already in outreach queue."}
          {notice !== "added" && notice !== "updated" && notice !== "already_exists" ? notice : null}
        </div>
      ) : null}

      <form className="grid grid-cols-1 gap-3 rounded-xl bg-white p-4 shadow md:grid-cols-4" method="GET">
        <label className="text-sm">
          <div className="mb-1 text-gray-600">City</div>
          <select className="w-full rounded border p-2" name="city" defaultValue={filters.city}>
            <option value="all">All cities</option>
            {options.cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <div className="mb-1 text-gray-600">Category</div>
          <select className="w-full rounded border p-2" name="category" defaultValue={filters.category}>
            <option value="all">All categories</option>
            {options.categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <div className="mb-1 text-gray-600">Instagram</div>
          <select className="w-full rounded border p-2" name="ig" defaultValue={filters.ig}>
            <option value="all">Any</option>
            <option value="with">With IG</option>
            <option value="without">Without IG</option>
          </select>
        </label>

        <label className="text-sm">
          <div className="mb-1 text-gray-600">Min Confidence</div>
          <select className="w-full rounded border p-2" name="confidence" defaultValue={filters.confidence}>
            <option value="0">Any</option>
            <option value="50">50+</option>
            <option value="70">70+</option>
            <option value="85">85+</option>
          </select>
        </label>

        <div className="md:col-span-4">
          <button className="rounded bg-black px-4 py-2 text-sm text-white" type="submit">
            Apply Filters
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Score</th>
              <th className="p-3">City</th>
              <th className="p-3">Category</th>
              <th className="p-3">Instagram</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((target) => {
                const inOutreach = outreachIds.has(target.operatorId);
                return (
                  <tr key={target.operatorId} className="border-t">
                    <td className="p-3 font-medium">{target.name}</td>
                    <td className="p-3">{target.confidenceScore}</td>
                    <td className="p-3">{target.city}</td>
                    <td className="p-3">{target.category}</td>
                    <td className="p-3">
                      {target.instagram ? (
                        <a className="text-blue-600 hover:underline" href={target.instagram} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      ) : (
                        "None"
                      )}
                    </td>
                    <td className="p-3">
                      <form action={addToOutreach}>
                        <input name="operatorId" type="hidden" value={target.operatorId} />
                        <input name="name" type="hidden" value={target.name} />
                        <input name="ig" type="hidden" value={target.instagram || ""} />
                        <input name="city" type="hidden" value={target.city} />
                        <input name="category" type="hidden" value={target.category} />
                        <input name="priority" type="hidden" value={target.confidenceScore >= 85 ? "high" : "normal"} />
                        <button className="text-blue-600 hover:underline" type="submit">
                          {inOutreach ? "Already in Outreach" : "Add to Outreach"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="p-4 text-gray-500" colSpan={6}>
                  No approved targets matched the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <NextActionLink href="/admin/activate" text={`Launch outreach from ${readyCount} ready targets`} />
    </div>
  );
}
