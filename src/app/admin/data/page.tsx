import { getPipelineOperationalSnapshot } from "@/lib/admin/pipeline/state";

export default async function DataPage() {
  const snapshot = await getPipelineOperationalSnapshot();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">System Data</h1>
        <p className="mt-1 text-sm text-gray-600">Compact operational view of canonical pipeline state, counts, and recent actions.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Pending DORA" value={snapshot.pendingBySource.DORA || 0} />
        <MetricCard label="Pending Social" value={snapshot.pendingBySource.SOCIAL || 0} />
        <MetricCard label="Approved" value={snapshot.approvedCount} />
        <MetricCard label="Merged" value={snapshot.mergedCount} />
        <MetricCard label="Rejected" value={snapshot.rejectedCount} />
        <MetricCard label="Outreach Queue" value={snapshot.outreachCount} />
      </div>

      <section className="rounded-xl bg-white p-4 shadow">
        <h2 className="font-semibold">Recent Queue / Resolution Items</h2>
        <div className="mt-3 space-y-3 text-sm">
          {snapshot.recentValidationRows.length ? (
            snapshot.recentValidationRows.map((row) => (
              <div key={row.queueItemId} className="rounded-lg border p-3">
                <div className="font-medium">
                  {row.displayName} · {row.status}
                </div>
                <div className="text-gray-500">
                  {row.sourceType} / {row.queueItemId}
                </div>
                <div className="text-xs text-gray-500">{row.resolvedAt || row.createdAt}</div>
              </div>
            ))
          ) : (
            <div className="text-gray-500">No recent queue items yet.</div>
          )}
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 shadow">
        <h2 className="font-semibold">Recent Admin Actions</h2>
        <div className="mt-3 space-y-3 text-sm">
          {snapshot.recentAdminActions.length ? (
            snapshot.recentAdminActions.map((entry) => (
              <div key={`${entry.timestamp}-${entry.entityId}`} className="rounded-lg border p-3">
                <div className="font-medium">
                  {entry.action} · {entry.result}
                </div>
                <div className="text-gray-500">
                  {entry.entityType} / {entry.entityId}
                </div>
                <div className="text-xs text-gray-500">{entry.timestamp}</div>
              </div>
            ))
          ) : (
            <div className="text-gray-500">No admin actions logged yet.</div>
          )}
        </div>
      </section>
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
