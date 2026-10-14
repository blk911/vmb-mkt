"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type WorkList = {
  id: string;
  name: string;
  updatedAt: string;
  techIds: string[];
  membershipMode?: "fixed" | "dynamic";
  workflow?: { owner?: string; stage?: string; disposition?: string; nextActionAt?: string; nextAction?: string; pinned?: boolean };
};
type Report = {
  ok: boolean;
  error?: string;
  generatedAt: string;
  summary: { listCount: number; totalTargets: number; pinnedCount: number; overdueCount: number; unassignedCount: number; staleCount: number; stageCounts: Record<string, number>; ownerCounts: Record<string, number> };
  lists: WorkList[];
};

function dateLabel(iso?: string) {
  if (!iso) return "Not scheduled";
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : parsed.toLocaleString();
}

export default function ListWorkload({ listsHref = "/admin/lists" }: { listsHref?: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/dashboard/ops-report", { cache: "no-store", signal: controller.signal });
        const body = await response.json() as Report;
        if (!response.ok || !body.ok || !body.summary || !Array.isArray(body.lists)) throw new Error(body.error || "List workload is unavailable. Please retry.");
        if (!controller.signal.aborted) setReport(body);
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "List workload is unavailable. Please retry.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [refresh]);

  const priorityLists = useMemo(() => (report?.lists || [])
    .filter((list) => list.workflow?.pinned || list.workflow?.nextActionAt || !list.workflow?.owner)
    .sort((a, b) => Number(!!b.workflow?.pinned) - Number(!!a.workflow?.pinned)
      || (Date.parse(a.workflow?.nextActionAt || "") || Infinity) - (Date.parse(b.workflow?.nextActionAt || "") || Infinity)
      || (b.updatedAt || "").localeCompare(a.updatedAt || ""))
    .slice(0, 8), [report]);

  const cards = [
    { label: "Tracked lists", value: report?.summary.listCount },
    { label: "Prospect memberships", value: report?.summary.totalTargets },
    { label: "Pinned lists", value: report?.summary.pinnedCount },
    { label: "Lists due now", value: report?.summary.overdueCount },
    { label: "Unassigned lists", value: report?.summary.unassignedCount },
    { label: "Unchanged for 14 days", value: report?.summary.staleCount },
  ];
  return <div className="mx-auto max-w-7xl space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <Link href={listsHref} className="text-sm text-slate-600 hover:underline">← My lists</Link>
        <h1 className="mt-2 text-2xl font-bold">List work view</h1>
        <p className="mt-1 text-sm text-slate-600">Priorities, due work, and owner workload across your shared lists.</p>
      </div>
      <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading} className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50">{loading ? "Refreshing…" : "Refresh"}</button>
    </div>
    {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}{report ? " Showing the last loaded summary." : ""}</div> : null}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">{cards.map((card) => <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-600">{card.label}</div><div className="mt-2 text-2xl font-bold">{card.value ?? "—"}</div>
    </div>)}</div>
    <p className="text-xs text-slate-500">Memberships count each list separately; a prospect can appear in more than one list. {report ? `Updated ${dateLabel(report.generatedAt)}.` : ""}</p>
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold">Priority work</h2>
        <div className="mt-3 space-y-3">{priorityLists.map((list) => <Link key={list.id} href={`${listsHref}?${new URLSearchParams({ listId: list.id })}`} className="block rounded-lg border border-slate-200 p-3 hover:border-slate-400">
          <div className="flex justify-between gap-3"><h3 className="font-semibold">{list.name}</h3>{list.workflow?.pinned ? <span className="text-xs font-semibold text-blue-700">Pinned</span> : null}</div>
          <p className="mt-1 text-xs text-slate-600">{list.workflow?.stage || "new"} · {list.workflow?.disposition || "open"} · {list.techIds.length} {list.membershipMode === "dynamic" ? "current matches" : "prospects"}</p>
          <p className="mt-2 text-sm text-slate-700">{list.workflow?.nextAction || "No next action recorded"}</p>
          <p className="mt-1 text-xs text-slate-500">Owner: {list.workflow?.owner || "Unassigned"} · Due: {dateLabel(list.workflow?.nextActionAt)}</p>
        </Link>)}</div>
        {!loading && !error && !priorityLists.length ? <p className="mt-3 text-sm text-slate-500">No priority lists yet. Pin a list or schedule its next action in My lists.</p> : null}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold">Lists by stage</h2>
        <div className="mt-3 space-y-2">{Object.entries(report?.summary.stageCounts || {}).map(([stage, count]) => <div key={stage} className="flex justify-between text-sm"><span className="capitalize">{stage}</span><strong>{count}</strong></div>)}</div>
        <h2 className="mt-6 text-base font-semibold">Lists by owner</h2>
        <div className="mt-3 space-y-2">{Object.entries(report?.summary.ownerCounts || {}).sort((a, b) => b[1] - a[1]).map(([owner, count]) => <div key={owner} className="flex justify-between text-sm"><span>{owner}</span><strong>{count}</strong></div>)}</div>
        {!loading && !error && !Object.keys(report?.summary.ownerCounts || {}).length ? <p className="mt-3 text-sm text-slate-500">Assign list owners to see their workload here.</p> : null}
      </section>
    </div>
  </div>;
}
