import Link from "next/link";
import NextActionLink from "@/components/admin/pipeline/NextActionLink";
import { getValidationLoadDebugInfo } from "@/lib/admin/pipeline/runtime-debug";
import { getPipelineOperationalSnapshot } from "@/lib/admin/pipeline/state";
import { listPendingValidationReviewRows } from "@/lib/admin/pipeline/validation";

export const dynamic = "force-dynamic";

export default async function ValidatePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  const intakeId = typeof params.intakeId === "string" ? params.intakeId : undefined;
  const [rows, snapshot, debug] = await Promise.all([
    listPendingValidationReviewRows(intakeId),
    getPipelineOperationalSnapshot(),
    getValidationLoadDebugInfo(),
  ]);
  const status = typeof params.status === "string" ? params.status : undefined;
  const action = typeof params.action === "string" ? params.action : undefined;
  const message = typeof params.message === "string" ? params.message : undefined;
  const pageTitle = intakeId ? "Submission Review" : "Review Queue";
  const pageDescription = intakeId
    ? "Showing pending review rows for this intake only."
    : "Pending candidates across all intakes. Open any row to review lane-specific evidence and actions.";
  const detailHrefSuffix = intakeId ? `?${new URLSearchParams({ intakeId }).toString()}` : "";
  const scopedLaneCounts = rows.reduce(
    (acc, row) => {
      for (const lane of row.lanes) {
        if (lane === "DORA") acc.dora += 1;
        if (lane === "SOCIAL") acc.social += 1;
      }
      return acc;
    },
    { dora: 0, social: 0 }
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{pageTitle}</h1>
        <p className="mt-1 text-sm text-gray-600">{pageDescription}</p>
        {intakeId ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <div>
              Latest submission intake <span className="font-mono text-xs">{intakeId}</span>
            </div>
            <Link href="/admin/validate" className="font-medium text-blue-700 hover:underline">
              Open full review queue
            </Link>
          </div>
        ) : null}
      </div>

      {message ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${status === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          {action ? <span className="font-medium capitalize">{action}</span> : null} {message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label={intakeId ? "Rows In This Submission" : "Pending Review"} value={intakeId ? rows.length : snapshot.metrics.pendingValidation} />
        <MetricCard label="Pending DORA" value={intakeId ? scopedLaneCounts.dora : snapshot.pendingBySource.DORA || 0} />
        <MetricCard label="Pending Social" value={intakeId ? scopedLaneCounts.social : snapshot.pendingBySource.SOCIAL || 0} />
      </div>

      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 shadow">
        <h2 className="font-semibold">Queue Runtime Debug</h2>
        <p className="mt-1 text-sm text-gray-600">Read-only instrumentation for confirming the queue store currently visible to this page load.</p>
        <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
          <DebugRow label="Checked at" value={debug.checkedAt} />
          <DebugRow label="Runtime root" value={debug.runtimeRoot} />
          <DebugRow label="Canonical store" value={debug.canonicalStoreMode} />
          <DebugRow label="Storage mode" value={debug.storageMode} />
          <DebugRow label="Environment" value={debug.environment} />
          <DebugRow label="Instance" value={`${debug.instanceHost} / pid ${debug.instancePid}`} />
          <DebugRow label="DORA queue count" value={`${debug.doraQueueCount}`} />
          <DebugRow label="Social queue count" value={`${debug.socialQueueCount}`} />
          <DebugRow
            label="Latest DORA queue item"
            value={debug.latestDoraQueueItemId ? `${debug.latestDoraQueueItemId} · ${debug.latestDoraQueueCreatedAt || "unknown"}` : "none"}
          />
          <DebugRow
            label="Latest Social queue item"
            value={debug.latestSocialQueueItemId ? `${debug.latestSocialQueueItemId} · ${debug.latestSocialQueueCreatedAt || "unknown"}` : "none"}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">Candidate</th>
              <th className="p-3">Lanes</th>
              <th className="p-3">Status</th>
              <th className="p-3">Confidence</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.reviewKey} className="border-t">
                  <td className="p-3">
                    <div className="font-medium text-gray-900">{row.displayName}</div>
                    <div className="text-xs text-gray-500">
                      {[row.city, row.state].filter(Boolean).join(", ") || "Location unknown"}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-gray-400">{row.reviewKey}</div>
                    {row.instagramHandle || row.signalType || row.serviceHint || row.geoHint ? (
                      <div className="mt-1 text-xs text-amber-700">
                        IG context:{" "}
                        {[
                          row.instagramHandle ? `@${row.instagramHandle.replace(/^@/, "")}` : null,
                          row.signalType ? `signal ${row.signalType}` : null,
                          row.serviceHint ? `service ${row.serviceHint}` : null,
                          row.geoHint ? `geo ${row.geoHint}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {row.lanes.map((lane) => (
                        <LaneBadge key={lane} lane={lane} />
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-xs text-gray-700">
                    {row.lanes.map((lane) => (
                      <div key={lane}>
                        {lane}: {row.laneStatuses[lane] || "pending"}
                      </div>
                    ))}
                  </td>
                  <td className="p-3">{row.confidence}</td>
                  <td className="p-3">
                    <Link href={`/admin/validate/${encodeURIComponent(row.reviewKey)}${detailHrefSuffix}`} className="text-blue-600 hover:underline">
                      Review
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="p-4 text-gray-500" colSpan={5}>
                  {intakeId ? "No pending review rows found for this intake." : "No queue items found."}
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

function LaneBadge({ lane }: { lane: "DORA" | "SOCIAL" }) {
  const className =
    lane === "DORA"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-purple-200 bg-purple-50 text-purple-700";
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}>{lane}</span>;
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="break-all text-gray-900">{value}</div>
    </div>
  );
}
