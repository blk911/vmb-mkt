"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  computePriorityScore,
  computeReferralCounts,
  getActivityRank,
  getEffectivePriorityScore,
  getProfileHealthRank,
  getTopReferredHandles,
  isReadyToAttack,
  upsertReferralEdge,
} from "@/lib/social-targets/target-utils";
import type {
  ActivitySignal,
  ProfileHealth,
  ReferralCategory,
  ReferralEdge,
  SocialTarget,
  SocialTargetStatus,
} from "@/types/social-target";

type Props = {
  initialTargets: SocialTarget[];
  initialReferralEdges: ReferralEdge[];
  showDevReset?: boolean;
};

const REFERRAL_CATEGORIES: ReferralCategory[] = ["nails", "hair", "lashes", "brows", "spa", "other"];

const STATUS_OPTIONS: SocialTargetStatus[] = ["new", "contacted", "qualified", "paused", "responded", "live"];

const PROFILE_HEALTH_EDIT: ProfileHealth[] = [
  "active",
  "not_found",
  "renamed_or_moved",
  "stale",
  "private",
  "unknown",
];

const ACTIVITY_EDIT: ActivitySignal[] = ["hot", "warm", "cold", "unknown"];

const PROFILE_HEALTH_FILTER: Array<"all" | ProfileHealth> = [
  "all",
  "active",
  "stale",
  "private",
  "renamed_or_moved",
  "not_found",
  "unknown",
];

const ACTIVITY_FILTER: Array<"all" | ActivitySignal> = ["all", "hot", "warm", "cold", "unknown"];

const MIN_PRIORITY_FILTER: Array<"all" | 50 | 70 | 80> = ["all", 50, 70, 80];

const EMPTY_REFERRAL_DRAFT: { toHandle: string; referredCategory: ReferralCategory; note: string } = {
  toHandle: "",
  referredCategory: "hair",
  note: "",
};

function stripAt(h: string): string {
  return h.replace(/^@/, "").trim();
}

function igProfileUrl(handle: string): string {
  return `https://www.instagram.com/${encodeURIComponent(stripAt(handle))}/`;
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

function hasHotTag(t: SocialTarget): boolean {
  return Boolean(t.tags?.some((tag) => tag.toUpperCase() === "HOT"));
}

function matchesProfileHealthFilter(t: SocialTarget, f: (typeof PROFILE_HEALTH_FILTER)[number]): boolean {
  if (f === "all") return true;
  if (f === "unknown") return !t.profileHealth || t.profileHealth === "unknown";
  return t.profileHealth === f;
}

function matchesActivityFilter(t: SocialTarget, f: (typeof ACTIVITY_FILTER)[number]): boolean {
  if (f === "all") return true;
  if (f === "unknown") return !t.activitySignal || t.activitySignal === "unknown";
  return t.activitySignal === f;
}

function formatVerifiedAt(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

function toApiTarget(t: SocialTarget): SocialTarget {
  const row: SocialTarget = {
    id: t.id,
    handle: stripAt(t.handle),
    zone: t.zone,
    category: t.category,
    status: t.status ?? "new",
    tags: t.tags ?? [],
  };
  if (t.businessName) row.businessName = t.businessName;
  if (t.notes) row.notes = t.notes;
  if (t.booking) row.booking = t.booking;
  if (typeof t.followers === "number") row.followers = t.followers;
  if (t.profileHealth) row.profileHealth = t.profileHealth;
  if (t.lastVerifiedAt) row.lastVerifiedAt = t.lastVerifiedAt;
  if (t.verificationNote) row.verificationNote = t.verificationNote;
  if (t.activitySignal) row.activitySignal = t.activitySignal;
  if (typeof t.priorityScore === "number") row.priorityScore = t.priorityScore;
  if (t.priorityScoreManual === true) row.priorityScoreManual = true;
  if (t.outreachAngle) row.outreachAngle = t.outreachAngle;
  return row;
}

function afterHealthOrActivityChange(t: SocialTarget, patch: Partial<SocialTarget>): SocialTarget {
  const next = { ...t, ...patch };
  if (t.priorityScoreManual === true && patch.priorityScoreManual !== false) {
    return next;
  }
  return {
    ...next,
    priorityScore: computePriorityScore(next),
    priorityScoreManual: false,
  };
}

export default function SocialTargetsTable({
  initialTargets,
  initialReferralEdges,
  showDevReset = false,
}: Props) {
  const router = useRouter();
  const [baseTargets, setBaseTargets] = useState<SocialTarget[]>(initialTargets);
  const [referralEdges, setReferralEdges] = useState<ReferralEdge[]>(initialReferralEdges);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const serverSnapshotKey = useMemo(
    () => JSON.stringify({ targets: initialTargets, edges: initialReferralEdges }),
    [initialTargets, initialReferralEdges]
  );
  const lastServerKey = useRef<string | null>(null);
  useEffect(() => {
    if (lastServerKey.current === serverSnapshotKey) return;
    lastServerKey.current = serverSnapshotKey;
    setBaseTargets(initialTargets);
    setReferralEdges(initialReferralEdges);
  }, [serverSnapshotKey, initialTargets, initialReferralEdges]);

  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | SocialTargetStatus>("all");
  const [profileHealthFilter, setProfileHealthFilter] = useState<(typeof PROFILE_HEALTH_FILTER)[number]>("all");
  const [activityFilter, setActivityFilter] = useState<(typeof ACTIVITY_FILTER)[number]>("all");
  const [minPriority, setMinPriority] = useState<(typeof MIN_PRIORITY_FILTER)[number]>("all");
  const [readyToAttackOnly, setReadyToAttackOnly] = useState(false);
  const [hideDeadProfiles, setHideDeadProfiles] = useState(false);
  const [hotTagOnly, setHotTagOnly] = useState(false);
  const [referralHubsOnly, setReferralHubsOnly] = useState(false);
  const [sortBy, setSortBy] = useState<
    "name" | "zone" | "referredByCount" | "priorityScore" | "activitySignal" | "profileHealth"
  >("priorityScore");
  const [sortDesc, setSortDesc] = useState(true);
  const [rowDrafts, setRowDrafts] = useState<
    Record<string, { toHandle: string; referredCategory: ReferralCategory; note: string }>
  >({});

  const targets = useMemo(() => {
    const withRef = computeReferralCounts(baseTargets, referralEdges);
    return withRef.map((t) => ({
      ...t,
      priorityScore: getEffectivePriorityScore(t),
    }));
  }, [baseTargets, referralEdges]);

  const persistTargetsList = useCallback(async (next: SocialTarget[]) => {
    setSaveError(null);
    try {
      const res = await fetch("/api/social-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets: next.map(toApiTarget) }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok !== true) {
        setSaveError(data.error || `Targets save failed (${res.status})`);
      }
    } catch {
      setSaveError("Targets save failed (network)");
    }
  }, []);

  const persistEdgesList = useCallback(async (next: ReferralEdge[]) => {
    setSaveError(null);
    try {
      const res = await fetch("/api/social-targets/referral-edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edges: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok !== true) {
        setSaveError(data.error || `Referral edges save failed (${res.status})`);
      }
    } catch {
      setSaveError("Referral edges save failed (network)");
    }
  }, []);

  const onResetToSeed = useCallback(async () => {
    if (!showDevReset) return;
    setResetBusy(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/social-targets/reset", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok !== true) {
        setSaveError(data.error || `Reset failed (${res.status})`);
        return;
      }
      router.refresh();
    } catch {
      setSaveError("Reset failed (network)");
    } finally {
      setResetBusy(false);
    }
  }, [router, showDevReset]);

  const zones = useMemo(() => {
    const z = new Set<string>();
    for (const t of baseTargets) z.add(t.zone);
    return [...z].sort();
  }, [baseTargets]);

  const categories = useMemo(() => {
    const c = new Set<string>();
    for (const t of baseTargets) c.add(t.category);
    return [...c].sort();
  }, [baseTargets]);

  const operatorKpis = useMemo(() => {
    const total = baseTargets.length;
    const activeProfiles = baseTargets.filter((t) => t.profileHealth === "active").length;
    const ready = baseTargets.filter(isReadyToAttack).length;
    const deadBroken = baseTargets.filter(
      (t) => t.profileHealth === "not_found" || t.profileHealth === "renamed_or_moved"
    ).length;
    const liveProviders = baseTargets.filter((t) => t.status === "live").length;
    return { total, activeProfiles, ready, deadBroken, liveProviders };
  }, [baseTargets]);

  const topReadyTargets = useMemo(() => {
    return baseTargets
      .filter(isReadyToAttack)
      .map((t) => ({
        t,
        score: getEffectivePriorityScore(t),
        followers: t.followers ?? 0,
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.followers - a.followers;
      })
      .slice(0, 10)
      .map((x) => x.t);
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
    if (categoryFilter !== "all") list = list.filter((t) => t.category === categoryFilter);
    if (statusFilter !== "all") list = list.filter((t) => (t.status ?? "new") === statusFilter);
    list = list.filter((t) => matchesProfileHealthFilter(t, profileHealthFilter));
    list = list.filter((t) => matchesActivityFilter(t, activityFilter));
    if (minPriority !== "all") {
      list = list.filter((t) => (t.priorityScore ?? 0) >= minPriority);
    }
    if (readyToAttackOnly) list = list.filter(isReadyToAttack);
    if (hideDeadProfiles) {
      list = list.filter((t) => t.profileHealth !== "not_found" && t.profileHealth !== "renamed_or_moved");
    }
    if (hotTagOnly) list = list.filter(hasHotTag);
    if (referralHubsOnly) list = list.filter((t) => t.isReferralHub);

    const dir = sortDesc ? -1 : 1;
    list.sort((a, b) => {
      if (sortBy === "priorityScore") {
        const va = a.priorityScore ?? 0;
        const vb = b.priorityScore ?? 0;
        if (va !== vb) return (vb - va) * (sortDesc ? 1 : -1);
      } else if (sortBy === "activitySignal") {
        const ra = getActivityRank(a.activitySignal);
        const rb = getActivityRank(b.activitySignal);
        if (ra !== rb) return (rb - ra) * (sortDesc ? 1 : -1);
      } else if (sortBy === "profileHealth") {
        const ra = getProfileHealthRank(a.profileHealth);
        const rb = getProfileHealthRank(b.profileHealth);
        if (ra !== rb) return (rb - ra) * (sortDesc ? 1 : -1);
      } else if (sortBy === "referredByCount") {
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
  }, [
    targets,
    search,
    zoneFilter,
    categoryFilter,
    statusFilter,
    profileHealthFilter,
    activityFilter,
    minPriority,
    readyToAttackOnly,
    hideDeadProfiles,
    hotTagOnly,
    referralHubsOnly,
    sortBy,
    sortDesc,
  ]);

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

  const setStatus = useCallback(
    (id: string, status: SocialTargetStatus) => {
      setBaseTargets((prev) => {
        const next = prev.map((t) => {
          if (t.id !== id) return t;
          const patched = { ...t, status };
          if (t.priorityScoreManual === true) return patched;
          return {
            ...patched,
            priorityScore: computePriorityScore(patched),
            priorityScoreManual: false,
          };
        });
        void persistTargetsList(next);
        return next;
      });
    },
    [persistTargetsList]
  );

  const onProfileHealthChange = useCallback(
    (id: string, health: ProfileHealth) => {
      setBaseTargets((prev) => {
        const next = prev.map((t) => {
          if (t.id !== id) return t;
          return afterHealthOrActivityChange(t, {
            profileHealth: health,
            lastVerifiedAt: new Date().toISOString(),
          });
        });
        void persistTargetsList(next);
        return next;
      });
    },
    [persistTargetsList]
  );

  const onActivitySignalChange = useCallback(
    (id: string, signal: ActivitySignal) => {
      setBaseTargets((prev) => {
        const next = prev.map((t) => {
          if (t.id !== id) return t;
          return afterHealthOrActivityChange(t, { activitySignal: signal });
        });
        void persistTargetsList(next);
        return next;
      });
    },
    [persistTargetsList]
  );

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
      void persistEdgesList(next);
      setRowDrafts((prev) => ({
        ...prev,
        [from.id]: { toHandle: "", referredCategory: d.referredCategory, note: "" },
      }));
    },
    [baseTargets, getDraft, persistEdgesList, referralEdges]
  );

  const promoteNodeToTarget = useCallback((node: { toHandle: string; category: string }) => {
    setBaseTargets((prev) => {
      const existing = handleMatchesTarget(prev, node.toHandle);
      if (existing) return prev;
      const id = promoteIdForHandle(node.toHandle);
      if (prev.some((t) => t.id === id)) return prev;
      const cat = referralCategoryToTargetCategory(node.category as ReferralCategory);
      const row: SocialTarget = {
        id,
        handle: stripAt(node.toHandle),
        zone: "park-meadows",
        category: cat,
        tags: ["REFERRAL_DISCOVERED"],
        status: "new",
        profileHealth: "unknown",
        activitySignal: "unknown",
        priorityScoreManual: false,
        priorityScore: computePriorityScore({
          id,
          handle: stripAt(node.toHandle),
          zone: "park-meadows",
          category: cat,
          tags: ["REFERRAL_DISCOVERED"],
          status: "new",
          profileHealth: "unknown",
          activitySignal: "unknown",
        }),
      };
      const next = [...prev, row];
      void persistTargetsList(next);
      return next;
    });
  }, [persistTargetsList]);

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
            Park Meadows / DTC — verification, priority, referrals. Edits persist to{" "}
            <code className="rounded bg-neutral-100 px-1 text-[11px]">runtime-data/*.generated.json</code>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showDevReset ? (
            <button
              type="button"
              disabled={resetBusy}
              onClick={() => void onResetToSeed()}
              className="rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50"
            >
              {resetBusy ? "Resetting…" : "Reset to seed data"}
            </button>
          ) : null}
        </div>
      </div>

      {saveError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">{saveError}</div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Total targets</p>
          <p className="text-2xl font-bold tabular-nums text-slate-950">{operatorKpis.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">Active profiles</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-950">{operatorKpis.activeProfiles}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/90 px-3 py-2 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-rose-900">Ready to attack</p>
          <p className="text-2xl font-bold tabular-nums text-rose-950">{operatorKpis.ready}</p>
        </div>
        <div className="rounded-xl border border-neutral-300 bg-neutral-100/90 px-3 py-2 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">Dead / broken</p>
          <p className="text-2xl font-bold tabular-nums text-neutral-900">{operatorKpis.deadBroken}</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50/90 px-3 py-2 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-sky-900">Live providers</p>
          <p className="text-2xl font-bold tabular-nums text-sky-950">{operatorKpis.liveProviders}</p>
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

      <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4">
        <h2 className="text-[11px] font-bold uppercase tracking-wide text-rose-900">Top ready targets</h2>
        <p className="mt-1 text-xs text-neutral-600">Active + warm/hot + status new — sorted by score, then followers.</p>
        {topReadyTargets.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No rows match Ready to Attack criteria.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {topReadyTargets.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-100 bg-white px-3 py-2 text-xs"
              >
                <div>
                  <a
                    href={igProfileUrl(t.handle)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-rose-900 underline-offset-2 hover:underline"
                  >
                    @{stripAt(t.handle)}
                  </a>
                  <span className="ml-2 text-neutral-500">{t.category}</span>
                  <span className="ml-2 font-bold tabular-nums text-neutral-800">{getEffectivePriorityScore(t)}</span>
                  {t.outreachAngle ? (
                    <p className="mt-1 max-w-md text-[11px] text-neutral-600">{t.outreachAngle}</p>
                  ) : null}
                </div>
                <a
                  href={igProfileUrl(t.handle)}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold uppercase text-rose-900 hover:bg-rose-100"
                >
                  Open IG
                </a>
              </li>
            ))}
          </ul>
        )}
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
          Category
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="mt-0.5 block max-w-[10rem] rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="all">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
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
        <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Profile health
          <select
            value={profileHealthFilter}
            onChange={(e) => setProfileHealthFilter(e.target.value as (typeof PROFILE_HEALTH_FILTER)[number])}
            className="mt-0.5 block max-w-[11rem] rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
          >
            {PROFILE_HEALTH_FILTER.map((f) => (
              <option key={f} value={f}>
                {f === "all" ? "All" : f.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Activity
          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value as (typeof ACTIVITY_FILTER)[number])}
            className="mt-0.5 block rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
          >
            {ACTIVITY_FILTER.map((f) => (
              <option key={f} value={f}>
                {f === "all" ? "All" : f}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Min priority
          <select
            value={minPriority === "all" ? "all" : String(minPriority)}
            onChange={(e) => {
              const v = e.target.value;
              setMinPriority(v === "all" ? "all" : (Number(v) as 50 | 70 | 80));
            }}
            className="mt-0.5 block rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="all">All</option>
            <option value="50">50+</option>
            <option value="70">70+</option>
            <option value="80">80+</option>
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
          <input
            type="checkbox"
            checked={readyToAttackOnly}
            onChange={(e) => setReadyToAttackOnly(e.target.checked)}
            className="rounded border-neutral-300"
          />
          Ready to attack only
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
          <input
            type="checkbox"
            checked={hideDeadProfiles}
            onChange={(e) => setHideDeadProfiles(e.target.checked)}
            className="rounded border-neutral-300"
          />
          Hide dead profiles
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
          <input
            type="checkbox"
            checked={hotTagOnly}
            onChange={(e) => setHotTagOnly(e.target.checked)}
            className="rounded border-neutral-300"
          />
          HOT tag only
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
            onChange={(e) =>
              setSortBy(
                e.target.value as
                  | "name"
                  | "zone"
                  | "referredByCount"
                  | "priorityScore"
                  | "activitySignal"
                  | "profileHealth"
              )
            }
            className="mt-0.5 block max-w-[11rem] rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="priorityScore">Priority score</option>
            <option value="activitySignal">Activity</option>
            <option value="profileHealth">Profile health</option>
            <option value="name">Handle</option>
            <option value="zone">Zone</option>
            <option value="referredByCount">Referred by</option>
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
        <table className="w-full min-w-[1400px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
              <th className="w-10 px-2 py-2">Sel</th>
              <th className="min-w-[200px] px-2 py-2">Target & signals</th>
              <th className="min-w-[160px] px-2 py-2">Verify & rank</th>
              <th className="px-2 py-2">Zone</th>
              <th className="px-2 py-2">Category</th>
              <th className="px-2 py-2">Status</th>
              <th className="min-w-[120px] px-2 py-2">Notes</th>
              <th className="px-2 py-2">Referral</th>
              <th className="min-w-[240px] px-2 py-2">Add referral</th>
            </tr>
          </thead>
          <tbody className="text-neutral-800">
            {filteredSorted.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-neutral-500">
                  No targets match filters.
                </td>
              </tr>
            ) : (
              filteredSorted.map((t) => {
                const draft = getDraft(t.id);
                const outgoing = t.referralCount ?? 0;
                const incoming = t.referredByCount ?? 0;
                const score = t.priorityScore ?? 0;
                const ready = isReadyToAttack(t);
                const baseRow = baseTargets.find((b) => b.id === t.id) ?? t;
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
                      <div className="flex flex-wrap items-center gap-1">
                        <div className="font-semibold text-neutral-900">@{stripAt(t.handle)}</div>
                        {ready ? (
                          <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-black uppercase text-white">
                            Ready
                          </span>
                        ) : null}
                        {score >= 80 ? (
                          <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-950">
                            80+
                          </span>
                        ) : null}
                      </div>
                      {t.businessName ? <div className="text-[11px] text-neutral-600">{t.businessName}</div> : null}
                      <div className="mt-1 space-y-0.5 text-[10px] text-neutral-600">
                        <div>
                          Health: <span className="font-semibold text-neutral-800">{t.profileHealth ?? "—"}</span>
                        </div>
                        <div>
                          Activity: <span className="font-semibold text-neutral-800">{t.activitySignal ?? "—"}</span>
                        </div>
                        <div>
                          Score: <span className="font-bold tabular-nums text-neutral-900">{score}</span>
                          {baseRow.priorityScoreManual ? (
                            <span className="ml-1 text-[9px] text-neutral-500">(manual)</span>
                          ) : null}
                        </div>
                        {t.outreachAngle ? (
                          <div className="text-[10px] text-neutral-700">Angle: {t.outreachAngle}</div>
                        ) : null}
                        <div>Verified: {formatVerifiedAt(t.lastVerifiedAt)}</div>
                      </div>
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
                    <td className="px-2 py-2">
                      <div className="flex max-w-[200px] flex-col gap-1.5">
                        <select
                          value={baseRow.profileHealth ?? "unknown"}
                          onChange={(e) => onProfileHealthChange(t.id, e.target.value as ProfileHealth)}
                          className="rounded border border-neutral-300 bg-white px-1 py-1 text-[10px]"
                        >
                          {PROFILE_HEALTH_EDIT.map((h) => (
                            <option key={h} value={h}>
                              {h.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                        <select
                          value={baseRow.activitySignal ?? "unknown"}
                          onChange={(e) => onActivitySignalChange(t.id, e.target.value as ActivitySignal)}
                          className="rounded border border-neutral-300 bg-white px-1 py-1 text-[10px]"
                        >
                          {ACTIVITY_EDIT.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                        <label className="text-[9px] font-semibold text-neutral-500">
                          Priority (0–100)
                          <input
                            type="number"
                            min={0}
                            max={100}
                            defaultValue={baseRow.priorityScore ?? score}
                            key={`${t.id}-prio-${baseRow.priorityScore}-${baseRow.priorityScoreManual}`}
                            onBlur={(e) => {
                              const n = Number(e.target.value);
                              if (!Number.isFinite(n)) return;
                              const clamped = Math.max(0, Math.min(100, Math.round(n)));
                              setBaseTargets((p) => {
                                const next = p.map((x) =>
                                  x.id === t.id
                                    ? { ...x, priorityScore: clamped, priorityScoreManual: true }
                                    : x
                                );
                                void persistTargetsList(next);
                                return next;
                              });
                            }}
                            className="mt-0.5 w-full rounded border border-neutral-300 bg-white px-1 py-0.5 text-[10px] tabular-nums"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setBaseTargets((p) => {
                              const next = p.map((x) => {
                                if (x.id !== t.id) return x;
                                const u = { ...x, priorityScoreManual: false as const };
                                return { ...u, priorityScore: computePriorityScore(u) };
                              });
                              void persistTargetsList(next);
                              return next;
                            });
                          }}
                          className="text-left text-[9px] font-semibold text-indigo-700 underline"
                        >
                          Use auto score
                        </button>
                        <textarea
                          key={`${t.id}-vnote-${baseRow.verificationNote ?? ""}`}
                          defaultValue={baseRow.verificationNote ?? ""}
                          rows={2}
                          placeholder="Verification note"
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            const prev = (baseRow.verificationNote ?? "").trim();
                            if (v === prev) return;
                            setBaseTargets((p) => {
                              const next = p.map((x) =>
                                x.id === t.id ? { ...x, ...(v ? { verificationNote: v } : { verificationNote: undefined }) } : x
                              );
                              void persistTargetsList(next);
                              return next;
                            });
                          }}
                          className="w-full rounded border border-neutral-300 bg-white px-1 py-0.5 text-[10px]"
                        />
                        <textarea
                          key={`${t.id}-angle-${baseRow.outreachAngle ?? ""}`}
                          defaultValue={baseRow.outreachAngle ?? ""}
                          rows={2}
                          placeholder="Outreach angle"
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            const prev = (baseRow.outreachAngle ?? "").trim();
                            if (v === prev) return;
                            setBaseTargets((p) => {
                              const next = p.map((x) =>
                                x.id === t.id ? { ...x, ...(v ? { outreachAngle: v } : { outreachAngle: undefined }) } : x
                              );
                              void persistTargetsList(next);
                              return next;
                            });
                          }}
                          className="w-full rounded border border-neutral-300 bg-white px-1 py-0.5 text-[10px]"
                        />
                      </div>
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
                      <textarea
                        key={`${t.id}-notes-${baseRow.notes ?? ""}`}
                        defaultValue={baseRow.notes ?? ""}
                        rows={2}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          const prev = (baseRow.notes ?? "").trim();
                          if (v === prev) return;
                          setBaseTargets((p) => {
                            const next = p.map((x) =>
                              x.id === t.id ? { ...x, ...(v ? { notes: v } : { notes: undefined }) } : x
                            );
                            void persistTargetsList(next);
                            return next;
                          });
                        }}
                        placeholder="Operator notes"
                        className="w-full min-w-[6rem] rounded border border-neutral-300 bg-white px-2 py-1 text-[11px] text-neutral-800"
                      />
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
                            className="min-w-[6rem] flex-1 rounded border border-neutral-300 bg-white px-2 py-1 text-[11px]"
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
