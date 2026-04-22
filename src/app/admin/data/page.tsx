import { getPipelineOperationalSnapshot } from "@/lib/admin/pipeline/state";
import { getPipelineReconciliationSnapshot } from "@/lib/admin/pipeline/reconciliation";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  const [snapshot, reconciliation] = await Promise.all([
    getPipelineOperationalSnapshot(),
    getPipelineReconciliationSnapshot(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">System Data</h1>
        <p className="mt-1 text-sm text-gray-600">Compact operational view of canonical pipeline state, counts, and recent actions.</p>
      </div>

      <section className="rounded-xl bg-white p-4 shadow">
        <h2 className="font-semibold">Canonical Pipeline Metrics</h2>
        <p className="mt-1 text-sm text-gray-600">Canonical only. These values drive the new admin pipeline and are not affected by supplemental legacy/runtime signals.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="Pending DORA" value={snapshot.pendingBySource.DORA || 0} />
          <MetricCard label="Pending Social" value={snapshot.pendingBySource.SOCIAL || 0} />
          <MetricCard label="Approved" value={snapshot.approvedCount} />
          <MetricCard label="Merged" value={snapshot.mergedCount} />
          <MetricCard label="Rejected" value={snapshot.rejectedCount} />
          <MetricCard label="Outreach Queue" value={snapshot.outreachCount} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div>
            <h3 className="font-medium">Recent Queue / Resolution Items</h3>
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
          </div>

          <div>
            <h3 className="font-medium">Recent Admin Actions</h3>
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
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 shadow">
        <h2 className="font-semibold">Legacy/Runtime Enrichment</h2>
        <p className="mt-1 text-sm text-amber-700">Read-only / supplemental. These joins are for visibility only and do not override canonical state, counts, ranking, or outreach behavior.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricCard
            label="Intakes With Processing Receipts"
            value={`${reconciliation.processingReceipts.intakesWithReceipts} / ${reconciliation.processingReceipts.totalIntakes}`}
          />
          <MetricCard
            label="Intakes With Drift Signals"
            value={`${reconciliation.drift.intakesWithDrift} / ${reconciliation.drift.totalIntakes}`}
          />
          <MetricCard
            label="Candidates With Link Hints"
            value={`${reconciliation.candidateLinks.candidatesWithLinks} / ${reconciliation.candidateLinks.totalCandidates}`}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <ReadOnlyList
            title="Processing Receipt Coverage By Intake"
            emptyLabel="No processing receipts joined to canonical intakes."
            items={reconciliation.processingReceipts.recent.map((row) => ({
              key: row.intakeId,
              title: `${row.sourceLabel} · ${row.intakeId}`,
              body: `matched ${row.matchedCount} · new ${row.newCandidateCount} · held ${row.heldCount}`,
              meta: row.processedAt,
            }))}
          />

          <ReadOnlyList
            title="Drift Coverage By Intake"
            emptyLabel="No supplemental drift events joined to canonical intakes."
            items={reconciliation.drift.recent.map((row) => ({
              key: `${row.intakeId}-${row.detectedAt}`,
              title: `${row.sourceLabel} · ${row.intakeId}`,
              body: `vs ${row.comparedAgainstIntakeId} · added ${row.added} · removed ${row.removed} · role ${row.roleChanged} · price ${row.priceChanged} · name ${row.nameChanged}`,
              meta: row.detectedAt,
            }))}
          />

          <ReadOnlyList
            title="Candidate-Link Coverage By Candidate"
            emptyLabel="No supplemental candidate-link hints joined to current validation candidates."
            items={reconciliation.candidateLinks.recent.map((row) => ({
              key: row.queueItemId,
              title: `${row.displayName} · ${row.candidateId}`,
              body: `${row.sourceType} / ${row.queueItemId} · hints ${row.linkCount} · best score ${row.bestScore}`,
              meta: "Targets intentionally hidden in Phase 5",
            }))}
          />
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 shadow">
        <h2 className="font-semibold">System Health Snapshot</h2>
        <p className="mt-1 text-sm text-amber-700">Read-only / supplemental. This section summarizes parallel runtime health and review coverage without affecting canonical pipeline behavior.</p>
        <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-lg border p-4">
            <h3 className="font-medium">Latest Resolver Summary Card</h3>
            {reconciliation.resolverSummary ? (
              <div className="mt-3 space-y-3 text-sm">
                <div className="text-gray-500">{reconciliation.resolverSummary.generatedAt}</div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <SummaryCell label="Evidence" value={reconciliation.resolverSummary.evidenceCount} />
                  <SummaryCell label="Operators" value={reconciliation.resolverSummary.operatorCount} />
                  <SummaryCell label="Hot" value={reconciliation.resolverSummary.hotCount} />
                  <SummaryCell label="Enriched" value={reconciliation.resolverSummary.enrichedCount} />
                  <SummaryCell label="Enumerated" value={reconciliation.resolverSummary.enumeratedCount} />
                  <SummaryCell label="Compacted" value={reconciliation.resolverSummary.compactedDuplicateCount} />
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm text-gray-500">No resolver summary snapshot found.</div>
            )}
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="font-medium">Review-State Coverage For Resolver-Backed Canonical Targets</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <SummaryCell label="Resolver-backed targets" value={reconciliation.reviewCoverage.resolverBackedCanonicalTargets} />
              <SummaryCell label="With review state" value={reconciliation.reviewCoverage.targetsWithReviewState} />
              <SummaryCell label="Ready" value={reconciliation.reviewCoverage.readyCount} />
              <SummaryCell label="Shelved" value={reconciliation.reviewCoverage.shelvedCount} />
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Latest review overlay: {reconciliation.reviewCoverage.latestReviewAt || "none"}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function ReadOnlyList({
  title,
  emptyLabel,
  items,
}: {
  title: string;
  emptyLabel: string;
  items: Array<{ key: string; title: string; body: string; meta: string }>;
}) {
  return (
    <div>
      <h3 className="font-medium">{title}</h3>
      <div className="mt-3 space-y-3 text-sm">
        {items.length ? (
          items.map((item) => (
            <div key={item.key} className="rounded-lg border p-3">
              <div className="font-medium">{item.title}</div>
              <div className="text-gray-600">{item.body}</div>
              <div className="text-xs text-gray-500">{item.meta}</div>
            </div>
          ))
        ) : (
          <div className="text-gray-500">{emptyLabel}</div>
        )}
      </div>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
