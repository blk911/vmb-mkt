import Link from "next/link";
import NextActionLink from "@/components/admin/pipeline/NextActionLink";
import { getPipelineOperationalSnapshot, listPendingValidationRows } from "@/lib/admin/pipeline/state";

export default async function ValidatePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  const [rows, snapshot] = await Promise.all([listPendingValidationRows(), getPipelineOperationalSnapshot()]);
  const status = typeof params.status === "string" ? params.status : undefined;
  const action = typeof params.action === "string" ? params.action : undefined;
  const message = typeof params.message === "string" ? params.message : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Validation Queue</h1>
        <p className="mt-1 text-sm text-gray-600">Only true pending queue items remain here; approved, merged, and rejected items are removed from this view.</p>
      </div>

      {message ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${status === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          {action ? <span className="font-medium capitalize">{action}</span> : null} {message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Pending Validation" value={snapshot.metrics.pendingValidation} />
        <MetricCard label="Pending DORA" value={snapshot.pendingBySource.DORA || 0} />
        <MetricCard label="Pending Social" value={snapshot.pendingBySource.SOCIAL || 0} />
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">Queue Item</th>
              <th className="p-3">Name</th>
              <th className="p-3">Source</th>
              <th className="p-3">Status</th>
              <th className="p-3">Confidence</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.queueItemId} className="border-t">
                  <td className="p-3 font-mono text-xs text-gray-600">{row.queueItemId}</td>
                  <td className="p-3">
                    <div className="font-medium text-gray-900">{row.displayName}</div>
                    <div className="text-xs text-gray-500">
                      {[row.city, row.state].filter(Boolean).join(", ") || "Location unknown"}
                    </div>
                  </td>
                  <td className="p-3">{row.sourceType}</td>
                  <td className="p-3">{row.status}</td>
                  <td className="p-3">{row.confidence}</td>
                  <td className="p-3">
                    <Link href={`/admin/validate/${encodeURIComponent(row.queueItemId)}`} className="text-blue-600 hover:underline">
                      Review
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="p-4 text-gray-500" colSpan={6}>
                  No queue items found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <NextActionLink href="/admin/target" text={`Select top targets from ${snapshot.metrics.readyTargets} approved operators`} />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
