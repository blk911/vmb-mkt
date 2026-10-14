import Link from "next/link";
import ProfileRefinementControls from "@/components/admin/pipeline/ProfileRefinementControls";
import { ProfileCheckState, ProfileLinks, SourceLink } from "@/components/admin/pipeline/ProfileEvidence";
import { profilePlatformLabel, profilePlatformExplanation, profileMissingLinkLabel, toRefinementQueueItem } from "@/lib/admin/pipeline/profile-presentation";
import NextActionLink from "@/components/admin/pipeline/NextActionLink";
import { getValidationLoadDebugInfo } from "@/lib/admin/pipeline/runtime-debug";
import { getPipelineOperationalSnapshot } from "@/lib/admin/pipeline/state";
import { listPendingValidationReviewRows } from "@/lib/admin/pipeline/validation";
import {
  parseValidationSort,
  sortValidationReviewRows,
  validationSortHref,
  type ValidationSearchParams,
  type ValidationSort,
  type ValidationSortColumn,
} from "@/lib/admin/pipeline/validation-sort";

export const dynamic = "force-dynamic";

export default async function ValidatePage({
  searchParams,
}: {
  searchParams?: Promise<ValidationSearchParams>;
}) {
  const params = (await searchParams) || {};
  const intakeId = typeof params.intakeId === "string" ? params.intakeId : undefined;
  const [rows, snapshot, debug] = await Promise.all([
    listPendingValidationReviewRows(intakeId),
    getPipelineOperationalSnapshot(),
    getValidationLoadDebugInfo(),
  ]);
  const sort = parseValidationSort(params);
  const sortedRows = sortValidationReviewRows(rows, sort);
  const status = typeof params.status === "string" ? params.status : undefined;
  const action = typeof params.action === "string" ? params.action : undefined;
  const message = typeof params.message === "string" ? params.message : undefined;
  const pageTitle = intakeId ? "Submission Review" : "Review Queue";
  const pageDescription = intakeId
    ? "Showing pending review rows for this intake only."
    : "Follow the booking platform and exact source links, then review the provider, salon, and location. Open a row for evidence and manual decisions.";
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
    <div className="min-w-0 space-y-6">
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

      <ProfileRefinementControls rows={sortedRows.map(toRefinementQueueItem)} scope={`queue:${intakeId || "all"}`} checkedAt={debug.checkedAt} />
      {debug.canonicalStoreMode === "file" ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Profile cache and check history are stored locally.{debug.environment === "vercel" ? " They may reset across hosted instances." : " They are available only on this instance."}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
        <p>Sort by a column heading. {sort ? `Sorted by ${sort.column === "candidate" ? "provider" : sort.column === "confidence" ? "extraction" : sort.column}, ${sort.direction === "asc" ? "ascending" : "descending"}.` : "Newest first."}</p>
        {sort ? (
          <Link href={validationSortHref(params)} className="text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
            Reset to newest first
          </Link>
        ) : null}
      </div>

      <p className="text-xs text-gray-500">Source-reported details may be partial. Extraction describes parsing quality, not verified identity. Scroll horizontally on smaller screens.</p>
      <div className="w-full max-w-full overflow-x-auto rounded-xl bg-white shadow" role="region" aria-label="Review queue, scroll horizontally for all columns" tabIndex={0}>
        <table className="w-full min-w-[88rem] table-fixed text-sm">
          <caption className="sr-only">Platform-first candidate review queue. Source claims are separate from manual review outcomes.</caption>
          <colgroup>
            <col className="w-[9%]" /><col className="w-[15%]" /><col className="w-[12%]" /><col className="w-[12%]" /><col className="w-[11%]" /><col className="w-[9%]" /><col className="w-[7%]" /><col className="w-[12%]" /><col className="w-[7%]" /><col className="w-[6%]" />
          </colgroup>
          <thead className="bg-gray-100 text-left">
            <tr>
              <SortHeader column="platform" label="Platform" params={params} sort={sort} />
              <th scope="col" className="p-3">Profile / booking link</th>
              <th scope="col" className="p-3">Social link</th>
              <SortHeader column="candidate" label="Provider" params={params} sort={sort} />
              <SortHeader column="salon" label="Salon" params={params} sort={sort} />
              <SortHeader column="location" label="City / ZIP" params={params} sort={sort} />
              <SortHeader column="lanes" label="Lanes" params={params} sort={sort} />
              <SortHeader column="status" label="Status" params={params} sort={sort} />
              <SortHeader column="confidence" label="Extraction" params={params} sort={sort} />
              <th scope="col" className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length ? sortedRows.map((row) => (
              <tr key={row.reviewKey} className="border-t align-top">
                <td className="break-words p-3"><div className="font-semibold text-gray-900">{profilePlatformLabel(row.profile)}</div><div className="mt-1 text-[11px] text-gray-500">{profilePlatformExplanation(row.profile)}</div></td>
                <td className="break-words p-3"><ProfileLinks compact links={row.profile?.bookingLinks || []} empty="No exact link found" />{row.profile?.sourceContextUrl || row.sourceUrl ? <div className="mt-2 text-xs"><SourceLink url={row.profile?.sourceContextUrl || row.sourceUrl} label="Original source" /></div> : null}</td>
                <td className="break-words p-3"><ProfileLinks compact links={row.profile?.socialLinks || []} />{row.instagramHandle ? <div className="mt-1 break-all text-xs text-gray-500">@{row.instagramHandle.replace(/^@/, "")}</div> : null}</td>
                <td className="break-words p-3"><div className="font-medium text-gray-900">{row.profile?.providerName || row.displayName}</div>{row.serviceHint ? <div className="mt-1 text-xs text-gray-500">{row.serviceHint}</div> : null}<div className="mt-2 text-[11px] text-gray-500">{row.sourceLabel}</div></td>
                <td className="break-words p-3">{row.profile?.businessName || <span className="text-gray-500">Unknown</span>}</td>
                <td className="break-words p-3">{[row.profile?.city || row.city, row.profile?.state || row.state, row.profile?.postalCode].filter(Boolean).join(", ") || <span className="text-gray-500">Unknown</span>}</td>
                <td className="p-3"><div className="flex flex-wrap gap-1">{row.lanes.map((lane) => <LaneBadge key={lane} lane={lane} />)}</div></td>
                <td className="break-words p-3"><ProfileCheckState profile={row.profile} /><div className="mt-2 space-y-1 border-t border-gray-100 pt-2 text-[11px] text-gray-500">{row.lanes.map((lane) => <div key={lane}>{lane}: {row.laneStatuses[lane] || "pending"}</div>)}</div></td>
                <td className="p-3"><span title="Source extraction quality; not identity verification">{row.confidence}</span></td>
                <td className="p-3"><Link href={`/admin/validate/${encodeURIComponent(row.reviewKey)}${detailHrefSuffix}`} className="text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">Review<span className="sr-only"> {row.displayName}</span></Link></td>
              </tr>
            )) : <tr><td className="p-4 text-gray-500" colSpan={10}>{intakeId ? "No pending review rows found for this intake." : "No queue items found."}</td></tr>}
          </tbody>
        </table>
      </div>

      <details className="rounded-xl border border-dashed border-gray-300 bg-white p-4">
        <summary className="cursor-pointer font-semibold">Queue runtime details</summary>
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
      </details>

      <NextActionLink href="/admin/target" text={`Select top targets from ${snapshot.metrics.readyTargets} approved operators`} />
    </div>
  );
}

function SortHeader({ column, label, params, sort }: {
  column: ValidationSortColumn;
  label: string;
  params: ValidationSearchParams;
  sort: ValidationSort | null;
}) {
  const active = sort?.column === column;
  const nextDirection = active && sort.direction === "asc" ? "descending" : "ascending";
  return (
    <th scope="col" className="p-3" aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}>
      <Link
        href={validationSortHref(params, column)}
        className="inline-flex items-center gap-1 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label={`Sort by ${label}, ${nextDirection}`}
      >
        {label} <span aria-hidden="true">{active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
      </Link>
    </th>
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
