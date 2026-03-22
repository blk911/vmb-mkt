"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { BestContactMethod, ContactConfidence, OutreachStatus } from "@/lib/unknown-resolver/resolver-types";
import { loadOutreachQueue } from "@/lib/unknown-resolver/resolver-storage";
import { isReadyToContact } from "@/lib/unknown-resolver/resolver-contact-readiness";
import OutreachQueueRow from "./OutreachQueueRow";

const STATUS_FILTER_OPTIONS: OutreachStatus[] = ["none", "new", "researching", "ready", "contacted", "ignored"];

const METHOD_FILTER: Array<"all" | BestContactMethod> = [
  "all",
  "unknown",
  "phone",
  "email",
  "website",
  "instagram",
  "facebook",
];

const CONF_FILTER: Array<"all" | ContactConfidence> = ["all", "high", "medium", "low"];

export default function OutreachQueuePage() {
  const [rows, setRows] = useState(() => loadOutreachQueue());
  const [statusFilter, setStatusFilter] = useState<"all" | OutreachStatus>("all");
  const [readyToContactOnly, setReadyToContactOnly] = useState(false);
  const [bestContactMethod, setBestContactMethod] = useState<"all" | BestContactMethod>("all");
  const [contactConfidence, setContactConfidence] = useState<"all" | ContactConfidence>("all");
  const [minReadinessScore, setMinReadinessScore] = useState<string>("");
  const [sortBy, setSortBy] = useState<"promoted" | "readiness">("promoted");

  const refresh = useCallback(() => {
    setRows(loadOutreachQueue());
  }, []);

  const filtered = useMemo(() => {
    let list = [...rows];

    if (statusFilter !== "all") {
      list = list.filter((r) => r.outreachStatus === statusFilter);
    }
    if (readyToContactOnly) {
      list = list.filter((r) => isReadyToContact(r));
    }
    if (bestContactMethod !== "all") {
      list = list.filter((r) => r.bestContactMethod === bestContactMethod);
    }
    if (contactConfidence !== "all") {
      list = list.filter((r) => r.contactConfidence === contactConfidence);
    }
    const minRaw = minReadinessScore.trim();
    if (minRaw !== "") {
      const minN = Number(minRaw);
      if (!Number.isNaN(minN)) {
        list = list.filter((r) => (r.contactReadinessScore ?? 0) >= minN);
      }
    }

    if (sortBy === "promoted") {
      list.sort((a, b) => {
        const ta = a.promotedAt ?? "";
        const tb = b.promotedAt ?? "";
        return tb.localeCompare(ta);
      });
    } else {
      list.sort((a, b) => {
        const sa = a.contactReadinessScore ?? -1;
        const sb = b.contactReadinessScore ?? -1;
        if (sb !== sa) return sb - sa;
        const ta = a.promotedAt ?? "";
        const tb = b.promotedAt ?? "";
        return tb.localeCompare(ta);
      });
    }

    return list;
  }, [rows, statusFilter, readyToContactOnly, bestContactMethod, contactConfidence, minReadinessScore, sortBy]);

  return (
    <div className="min-h-0 flex-1 space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Markets · Internal</p>
          <h1 className="text-xl font-semibold text-neutral-900">Outreach Queue</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            House cleaning targets promoted from Unknown Resolver. Enrich contacts, first-touch plan, and scripts — session-persisted.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/markets/unknown-resolver"
            className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            ← Unknown resolver
          </Link>
          <Link
            href="/admin/markets"
            className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            Markets
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-neutral-50/80 p-3">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | OutreachStatus)}
            className="mt-0.5 block rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="all">All</option>
            {STATUS_FILTER_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
          <input type="checkbox" checked={readyToContactOnly} onChange={(e) => setReadyToContactOnly(e.target.checked)} className="rounded border-neutral-300" />
          Ready to contact
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Best method
          <select
            value={bestContactMethod}
            onChange={(e) => setBestContactMethod(e.target.value as "all" | BestContactMethod)}
            className="mt-0.5 block rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
          >
            {METHOD_FILTER.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Confidence
          <select
            value={contactConfidence}
            onChange={(e) => setContactConfidence(e.target.value as "all" | ContactConfidence)}
            className="mt-0.5 block rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
          >
            {CONF_FILTER.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Min readiness
          <input
            type="number"
            min={0}
            max={100}
            placeholder="0"
            value={minReadinessScore}
            onChange={(e) => setMinReadinessScore(e.target.value)}
            className="mt-0.5 block w-20 rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs tabular-nums"
          />
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Sort
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "promoted" | "readiness")}
            className="mt-0.5 block rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="promoted">Promoted (newest)</option>
            <option value="readiness">Readiness (high → low)</option>
          </select>
        </label>
        <span className="text-xs text-neutral-500">{filtered.length} shown</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full min-w-[960px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
              <th className="w-8 px-2 py-2" />
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">City</th>
              <th className="px-2 py-2">Score</th>
              <th className="px-2 py-2">Ready</th>
              <th className="px-2 py-2">Conf</th>
              <th className="px-2 py-2">Method</th>
              <th className="px-2 py-2">Operator</th>
              <th className="px-2 py-2">Outreach status</th>
              <th className="px-2 py-2">Promoted</th>
            </tr>
          </thead>
          <tbody className="text-neutral-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-sm text-neutral-500">
                  No rows match filters. Approve <strong>yes</strong> in Unknown Resolver and click <strong>Promote to Outreach</strong>, or loosen filters.
                </td>
              </tr>
            ) : (
              filtered.map((r) => <OutreachQueueRow key={r.id} record={r} onRefresh={refresh} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
