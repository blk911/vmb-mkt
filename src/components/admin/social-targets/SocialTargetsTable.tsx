"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  computeReferralCounts,
  getTopReferredHandles,
  upsertReferralEdge,
} from "@/lib/social-targets/target-utils";
import type { ReferralCategory, ReferralEdge, SocialTarget, SocialTargetStatus } from "@/types/social-target";

type Props = {
  initialTargets: SocialTarget[];
  initialReferralEdges: ReferralEdge[];
};

const REFERRAL_CATEGORIES: ReferralCategory[] = ["nails", "hair", "lashes", "brows", "spa", "other"];

const STATUS_OPTIONS: SocialTargetStatus[] = ["new", "contacted", "qualified", "paused"];

const EMPTY_REFERRAL_DRAFT: { toHandle: string; referredCategory: ReferralCategory; note: string } = {
  toHandle: "",
  referredCategory: "hair",
  note: "",
};

function stripAt(h: string): string {
  return h.replace(/^@/, "").trim();
}

function handleMatchesTarget(targets: SocialTarget[], rawHandle: string): SocialTarget | undefined {
  const want = stripAt(rawHandle).toLowerCase();
  if (!want) return undefined;
  return targets.find((t) => stripAt(t.handle).toLowerCase() === want);
}

function promoteIdForHandle(handle: string): string {
  const base = stripAt(handle).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `ref-${base || "unknown"}`;
}

function referralCategoryToTargetCategory(cat: ReferralCategory): string {
  return cat;
}

export default function SocialTargetsTable({ initialTargets, initialReferralEdges }: Props) {
  const [baseTargets, setBaseTargets] = useState<SocialTarget[]>(initialTargets);
  const [referralEdges, setReferralEdges] = useState<ReferralEdge[]>(initialReferralEdges);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | SocialTargetStatus>("all");
  const [referralHubsOnly, setReferralHubsOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "zone" | "referredByCount">("name");
  const [sortDesc, setSortDesc] = useState(true);
  const [rowDrafts, setRowDrafts] = useState<
    Record<string, { toHandle: string; referredCategory: ReferralCategory; note: string }>
  >({});

  const targets = useMemo(() => computeReferralCounts(baseTargets, referralEdges), [baseTargets, referralEdges]);

  const zones = useMemo(() => {
    const z = new Set<string>();
    for (const t of baseTargets) z.add(t.zone);
    return [...z].sort();
  }, [baseTargets]);

  const topReferred = useMemo(() => getTopReferredHandles(referralEdges).slice(0, 5), [referralEdges]);

  const referralSummary = useMemo(() => {
    const multi = referralEdges.filter((e) => e.confidence === "multi").length;
    const hubs = targets.filter((t) => t.isReferralHub).length;
    const top = getTopReferredHandles(referralEdges)[0];
    return {
      totalEdges: referralEdges.length,
      multiEdges: multi,
      hubCount: hubs,
      topHandle: top?.toHandle,
      topSeen: top?.timesSeen,
    };
  }, [referralEdges, targets]);

  const filteredSorted = useMemo(() => {
    let list = [...targets];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const h = stripAt(t.handle).toLowerCase();
        const n = (t.businessName ?? "").toLowerCase();
        return h.includes(q) || n.includes(q);
      });
    }
    if (zoneFilter !== "all") list = list.filter((t) => t.zone === zoneFilter);
    if (statusFilter !== "all") list = list.filter((t) => (t.status ?? "new") === statusFilter);
    if (referralHubsOnly) list = list.filter((t) => t.isReferralHub);

    const dir = sortDesc ? -1 : 1;
    list.sort((a, b) => {
      if (sortBy === "referredByCount") {
        const va = a.referredByCount ?? 0;
        const vb = b.referredByCount ?? 0;
        if (va !== vb) return (vb - va) * (sortDesc ? 1 : -1);
      } else if (sortBy === "zone") {
        const c = a.zone.localeCompare(b.zone);
        if (c !== 0) return c * dir;
      } else {
        const c = stripAt(a.handle).localeCompare(stripAt(b.handle));
        if (c !== 0) return c * dir;
      }
      return a.id.localeCompare(b.id);
    });

    return list;
  }, [targets, search, zoneFilter, statusFilter, referralHubsOnly, sortBy, sortDesc]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(filteredSorted.map((t) => t.id)));
  }, [filteredSorted]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const copySelectedHandles = useCallback(async () => {
    const lines = filteredSorted
      .filter((t) => selectedIds.has(t.id))
      .map((t) => {
        const h = stripAt(t.handle);
        return h.startsWith("@") ? h : `@${h}`;
      });
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }, [filteredSorted, selectedIds]);

  const setStatus = useCallback((id: string, status: SocialTargetStatus) => {
    setBaseTargets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
  }, []);

  const getDraft = useCallback(
    (id: string) =>
      rowDrafts[id] ?? { toHandle: "", referredCategory: "hair" as ReferralCategory, note: "" },
    [rowDrafts]
  );

  const setDraftField = useCallback(
    (id: string, patch: Partial<{ toHandle: string; referredCategory: ReferralCategory; note: string }>) => {
      setRowDrafts((prev) => ({
        ...prev,
        [id]: { ...(prev[id] ?? EMPTY_REFERRAL_DRAFT), ...patch },
      }));
    },
    []
  );

  const addReferral = useCallback(
    (from: SocialTarget) => {
      const d = getDraft(from.id);
      const clean = stripAt(d.toHandle);
      if (!clean) return;
      const match = handleMatchesTarget(baseTargets, clean);
      const next = upsertReferralEdge(referralEdges, {
        fromTargetId: from.id,
        fromHandle: stripAt(from.handle),
        toHandle: clean,
        referredCategory: d.referredCategory,
        note: d.note.trim() || undefined,
        toTargetId: match?.id,
      });
      setReferralEdges(next);
      setRowDrafts((prev) => ({
        ...prev,
        [from.id]: { toHandle: "", referredCategory: d.referredCategory, note: "" },
      }));
    },
    [baseTargets, getDraft, referralEdges]
  );

  const promoteNodeToTarget = useCallback((node: { toHandle: string; category: string }) => {
    const existing = handleMatchesTarget(baseTargets, node.toHandle);
    if (existing) return;
    const id = promoteIdForHandle(node.toHandle);
    if (baseTargets.some((t) => t.id === id)) return;
    const cat = referralCategoryToTargetCategory(node.category as ReferralCategory);
    const row: SocialTarget = {
      id,
      handle: stripAt(node.toHandle),
      zone: "park-meadows",
      category: cat,
      tags: ["REFERRAL_DISCOVERED"],
      status: "new",
    };
    setBaseTargets((prev) => [...prev, row]);
  }, [baseTargets]);

  const isKnownReferredNode = useCallback(
    (handle: string) => Boolean(handleMatchesTarget(baseTargets, handle)),
    [baseTargets]
  );

  return (
    <div className="min-h-0 flex-1 space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">GTM · Internal</p>
          <h1 className="text-xl font-semibold text-neutral-900">Social targets</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Park Meadows / DTC cluster — targets, referral edges, and emerging trust signals (local JSON + session state).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/markets"
            className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            Markets
          </Link>
          <Link
            href="/admin/vmb"
            className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            VMB Admin
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Targets</p>
          <p className="text-2xl font-bold tabular-nums text-neutral-950">{baseTargets.length}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Shown</p>
          <p className="text-2xl font-bold tabular-nums text-neutral-950">{filteredSorted.length}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Selected</p>
          <p className="text-2xl font-bold tabular-nums text-neutral-950">{selectedIds.size}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Zones</p>
          <p className="text-2xl font-bold tabular-nums text-neutral-950">{zones.length}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-900">Referral edges</p>
          <p className="text-2xl font-bold tabular-nums text-indigo-950">{referralSummary.totalEdges}</p>
        </div>
        <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/80 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-fuchsia-900">Multi-confidence</p>
          <p className="text-2xl font-bold tabular-nums text-fuchsia-950">{referralSummary.multiEdges}</p>
        </div>
        <div className="rounded-xl border border-teal-200 bg-teal-50/80 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-teal-900">Referral hubs</p>
          <p className="text-2xl font-bold tabular-nums text-teal-950">{referralSummary.hubCount}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-900">Top referred</p>
          <p className="text-sm font-semibold text-amber-950">
            {referralSummary.topHandle ? (
              <>
                @{referralSummary.topHandle}{" "}
                <span className="text-xs font-normal text-amber-800">({referralSummary.topSeen}×)</span>
              </>
            ) : (
              <span className="text-neutral-500">—</span>
            )}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
        <h2 className="text-[11px] font-bold uppercase tracking-wide text-neutral-600">Emerging referral nodes</h2>
        <p className="mt-1 text-xs text-neutral-500">Top referred handles by category (includes handles not yet in the target list).</p>
        <ul className="mt-3 space-y-2">
          {topReferred.length === 0 ? (
            <li className="text-sm text-neutral-500">No referral edges yet.</li>
          ) : (
            topReferred.map((n) => {
              const known = isKnownReferredNode(n.toHandle);
              return (
                <li
                  key={`${n.toHandle}::${n.category}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs"
                >
                  <div>
                    <span className="font-semibold text-neutral-900">@{n.toHandle}</span>
                    <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-neutral-600">
                      {n.category}
                    </span>
                    <span className="ml-2 tabular-nums text-neutral-600">{n.timesSeen}×</span>
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        known ? "bg-emerald-100 text-emerald-900" : "bg-orange-100 text-orange-900"
                      }`}
                    >
                      {known ? "Internal" : "External"}
                    </span>
                  </div>
                  {!known ? (
                    <button
                      type="button"
                      onClick={() => promoteNodeToTarget(n)}
                      className="rounded-full border border-neutral-300 bg-neutral-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-800 hover:bg-white"
                    >
                      Promote to target
                    </button>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-neutral-50/80 p-3">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Search
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Handle or business"
            className="mt-0.5 block w-44 rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
          />
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Zone
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="mt-0.5 block max-w-[12rem] rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="all">All zones</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | SocialTargetStatus)}
            className="mt-0.5 block rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="all">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
          <input
            type="checkbox"
            checked={referralHubsOnly}
            onChange={(e) => setReferralHubsOnly(e.target.checked)}
            className="rounded border-neutral-300"
          />
          Referral hubs only
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Sort
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "name" | "zone" | "referredByCount")}
            className="mt-0.5 block rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="name">Handle</option>
            <option value="zone">Zone</option>
            <option value="referredByCount">Referred by (strength)</option>
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
          <input
            type="checkbox"
            checked={sortDesc}
            onChange={(e) => setSortDesc(e.target.checked)}
            className="rounded border-neutral-300"
          />
          Descending
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={selectAllVisible}
            className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-800 hover:bg-neutral-50"
          >
            Select visible
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-800 hover:bg-neutral-50"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => void copySelectedHandles()}
            className="rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-neutral-800"
          >
            Copy selected @handles
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full min-w-[1024px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
              <th className="w-10 px-2 py-2">Sel</th>
              <th className="px-2 py-2">Target</th>
              <th className="px-2 py-2">Zone</th>
              <th className="px-2 py-2">Category</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Referral signal</th>
              <th className="min-w-[280px] px-2 py-2">Add referral</th>
            </tr>
          </thead>
          <tbody className="text-neutral-800">
            {filteredSorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-neutral-500">
                  No targets match filters.
                </td>
              </tr>
            ) : (
              filteredSorted.map((t) => {
                const draft = getDraft(t.id);
                const outgoing = t.referralCount ?? 0;
                const incoming = t.referredByCount ?? 0;
                return (
                  <tr key={t.id} className="border-b border-neutral-100 align-top">
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(t.id)}
                        onChange={() => toggleSelect(t.id)}
                        className="rounded border-neutral-300"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-semibold text-neutral-900">@{stripAt(t.handle)}</div>
                      {t.businessName ? <div className="text-[11px] text-neutral-600">{t.businessName}</div> : null}
                      {t.tags?.length ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {t.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-neutral-700">{t.zone}</td>
                    <td className="px-2 py-2 text-neutral-700">{t.category}</td>
                    <td className="px-2 py-2">
                      <select
                        value={t.status ?? "new"}
                        onChange={(e) => setStatus(t.id, e.target.value as SocialTargetStatus)}
                        className="rounded border border-neutral-300 bg-white px-1.5 py-1 text-[11px]"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <div className="space-y-0.5 text-[11px] text-neutral-700">
                        <div>
                          Out: <span className="font-semibold tabular-nums text-neutral-900">{outgoing}</span>
                        </div>
                        <div>
                          In: <span className="font-semibold tabular-nums text-neutral-900">{incoming}</span>
                        </div>
                        {t.isReferralHub ? (
                          <span className="inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-900">
                            Hub
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-col gap-1.5">
                        <input
                          value={draft.toHandle}
                          onChange={(e) => setDraftField(t.id, { toHandle: e.target.value })}
                          placeholder="Referred @handle"
                          className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-[11px]"
                        />
                        <div className="flex flex-wrap gap-1">
                          <select
                            value={draft.referredCategory}
                            onChange={(e) =>
                              setDraftField(t.id, { referredCategory: e.target.value as ReferralCategory })
                            }
                            className="rounded border border-neutral-300 bg-white px-1.5 py-1 text-[11px]"
                          >
                            {REFERRAL_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <input
                            value={draft.note}
                            onChange={(e) => setDraftField(t.id, { note: e.target.value })}
                            placeholder="Note"
                            className="min-w-[8rem] flex-1 rounded border border-neutral-300 bg-white px-2 py-1 text-[11px]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => addReferral(t)}
                          className="self-start rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-indigo-700"
                        >
                          Add referral
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
