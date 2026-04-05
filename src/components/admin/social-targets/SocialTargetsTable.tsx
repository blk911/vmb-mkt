"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ensureSocialCandidates,
  getPrimaryCandidate,
  ingestSourceCandidateInputs,
  patchCandidate,
  setPrimaryCandidateId,
  sourceCandidateInputToSocialCandidate,
} from "@/lib/social-targets/social-candidate-logic";
import {
  mapProfileHealthToResolveStatus,
  normalizeSocialTarget,
  patchSocialProfile,
} from "@/lib/social-targets/normalization";
import {
  compareTargetsByOperatorRank,
  computeOperatorDisplayRank,
  featuredWeakerThanBestAlternate,
  getPrimaryOperationalState,
  isConfirmedRealNoSocial,
  pickBestFeaturedCandidateId,
} from "@/lib/social-targets/operator-rank";
import { confidenceTier } from "@/lib/social-targets/social-scoring";
import { SocialTargetEvidence } from "@/components/admin/social-targets/SocialTargetEvidence";
import {
  buildSourceIntakeInputsForTarget,
  classifySourceCandidate,
} from "@/lib/social-targets/source-intake-status";
import {
  SOCIAL_VERIFICATION_STATUSES,
  SOCIAL_VISIBILITY_STATES,
} from "@/lib/social-targets/social-profile-constants";
import {
  computePriorityScore,
  computeReferralCounts,
  getActivityRank,
  getEffectivePriorityScore,
  getProfileHealthRank,
  getTopReferredHandles,
  upsertReferralEdge,
} from "@/lib/social-targets/target-utils";
import {
  getVerificationState,
  getVerificationStatus,
  isLiveVerified,
  shouldHideTargetBecauseDead,
  shouldShowTargetInPrimaryView,
  shouldShowTargetInReviewView,
} from "@/lib/social-targets/target-visibility";
import { getFeaturedValidationIntegrity } from "@/lib/social-targets/featured-validation-integrity";
import type {
  ActivitySignal,
  ProfileHealth,
  ReferralCategory,
  ReferralEdge,
  SocialTarget,
  SocialTargetStatus,
  VerificationState,
  SocialVerificationStatus,
  SocialVisibilityState,
} from "@/types/social-target";
import type { SourceCandidateInput } from "@/lib/social-targets/source-adapters";
import type { BatchIngestResult, BatchIngestSummary } from "@/lib/social-targets/batch-ingest-types";

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
const VERIFICATION_STATE_FILTER: Array<"all" | VerificationState> = [
  "all",
  "live_verified",
  "unverified",
  "matched",
  "discovered",
  "dead",
  "rejected",
];
const CANDIDATE_TYPE_FILTER = ["all", "operator", "booking_operator", "aggregator", "directory", "ambiguous"] as const;

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

function profileUrlForTarget(t: SocialTarget): string {
  const integrity = getFeaturedValidationIntegrity(t);
  const u = integrity.displayCandidate?.url?.trim();
  if (u) return u;
  const plat = integrity.displayCandidate?.platform;
  const h = stripAt(integrity.displayCandidate?.handle ?? t.handle);
  if (plat === "tiktok") {
    return `https://www.tiktok.com/@${encodeURIComponent(h)}`;
  }
  if (plat === "linktree" && h) {
    return `https://linktr.ee/${encodeURIComponent(h)}`;
  }
  return igProfileUrl(h);
}

function displayHandleForTarget(t: SocialTarget): string {
  const primary = getPrimaryCandidate(ensureSocialCandidates(t));
  return stripAt(primary?.handle ?? t.handle);
}

function platformShortLabel(p: string): string {
  switch (p) {
    case "instagram":
      return "IG";
    case "tiktok":
      return "TT";
    case "linktree":
      return "LT";
    case "website":
      return "Web";
    case "booking":
      return "Book";
    default:
      return "?";
  }
}

function tierShortLabel(tier: ReturnType<typeof confidenceTier>): string {
  switch (tier) {
    case "high":
      return "High conf.";
    case "usable":
      return "Usable";
    case "review":
      return "Review";
    case "suppress":
      return "Low conf.";
  }
}

function TrustBadges({ t }: { t: SocialTarget }) {
  const integrity = getFeaturedValidationIntegrity(t);
  const primary = integrity.displayCandidate ?? getPrimaryCandidate(ensureSocialCandidates(t));
  const rs = integrity.displayResolveState;
  const vs = integrity.displayVerificationState;
  const act = integrity.displayActivityState;
  const tier = primary ? confidenceTier(primary.overallConfidenceScore) : "review";
  const tierCls =
    tier === "high"
      ? "bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200"
      : tier === "usable"
        ? "bg-sky-50 text-sky-950 ring-1 ring-sky-200"
        : tier === "review"
          ? "bg-amber-50 text-amber-950 ring-1 ring-amber-200"
          : "bg-neutral-200 text-neutral-800";
  const rsCls =
    rs === "live"
      ? "bg-emerald-100 text-emerald-900"
      : rs === "stale"
        ? "bg-amber-100 text-amber-950"
      : rs === "dead"
        ? "bg-red-100 text-red-900"
        : rs === "blocked"
          ? "bg-amber-100 text-amber-950"
          : "bg-neutral-100 text-neutral-700";
  const vsCls =
    vs === "manual_verified" || vs === "auto_verified"
      ? "bg-sky-100 text-sky-950"
      : vs === "verify_needed"
        ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
      : vs === "rejected"
        ? "bg-neutral-300 text-neutral-800"
        : "bg-violet-50 text-violet-900";
  const actCls =
    act === "recent" ? "bg-lime-100 text-lime-950" : act === "stale" ? "bg-orange-100 text-orange-950" : "bg-neutral-50 text-neutral-600";
  return (
    <div className="flex flex-wrap gap-1.5">
      {primary ? (
        <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-black uppercase text-white">
          {platformShortLabel(primary.platform)}
        </span>
      ) : null}
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tierCls}`}>{tierShortLabel(tier)}</span>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${rsCls}`}>{rs}</span>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${vsCls}`}>
        {vs.replace(/_/g, " ")}
      </span>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${actCls}`}>{act}</span>
      {integrity.needsRecheck ? (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950">verify needed</span>
      ) : null}
    </div>
  );
}

function TargetHandleLink({ t, children }: { t: SocialTarget; children: ReactNode }) {
  const dead = shouldHideTargetBecauseDead(t);
  const href = profileUrlForTarget(t);
  if (dead) {
    return (
      <span className="text-neutral-400 line-through" title="Dead or rejected — use Review mode to inspect">
        {children}
      </span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className="font-semibold text-rose-900 underline-offset-2 hover:underline">
      {children}
    </a>
  );
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

function socialCandidateIdentityKeyForIntake(c: { platform?: string; handle?: string; url?: string }): string {
  const platform = c.platform || "unknown";
  const handle = (c.handle ?? "").trim().toLowerCase();
  const url = (c.url ?? "").trim().toLowerCase();
  return `${platform}|${handle}|${url}`;
}

function sourceTypeBadgeLabel(sourceType: SourceCandidateInput["sourceType"]): string {
  switch (sourceType) {
    case "google":
      return "GOOGLE";
    case "google_maps":
      return "MAPS";
    case "yelp":
      return "YELP";
    case "dora":
      return "DORA";
    case "website":
      return "WEBSITE";
    default:
      return "SOURCE";
  }
}

function sourceTrustTierLabel(tier: SourceCandidateInput["sourceTrustTier"]): string {
  switch (tier) {
    case "tier1":
      return "T1";
    case "tier2":
      return "T2";
    case "tier3":
      return "T3";
    default:
      return "T?";
  }
}

function noSocialFallbackAngle(t: SocialTarget): string {
  const candidates = ensureSocialCandidates(t).socialCandidates ?? [];
  const hasBookingOrWeb = candidates.some((c) => c.platform === "booking" || c.platform === "website") || t.booking === "link";
  if (hasBookingOrWeb) return "Find live social via booking link or direct contact";
  if (t.businessName) return "Verify operator identity via phone / website";
  return "Check suite occupant or stylist name";
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

function evidenceCount(t: SocialTarget): number {
  return Array.isArray(t.evidence) ? t.evidence.length : 0;
}

function hasEvidencePlatform(t: SocialTarget, platform: "instagram" | "tiktok" | "linktree"): boolean {
  const fromPlatforms = Boolean(t.platforms?.[platform]);
  if (fromPlatforms) return true;
  return (t.evidence ?? []).some((ev) => ev.platform === platform || ev.type === platform);
}

function hasUnknownResolution(t: SocialTarget): boolean {
  return (t.resolutionStatus ?? "unknown") === "unknown";
}

function hasMultiSignal(t: SocialTarget): boolean {
  return evidenceCount(t) >= 3;
}

function hasBookingPlatformEvidence(t: SocialTarget): boolean {
  return (t.evidence ?? []).some((ev) => ev.type === "booking_platform" || ev.domainType === "booking_platform");
}

function hasAddressExpansionCandidates(t: SocialTarget): boolean {
  return (t.addressExpansion?.candidateCount ?? t.addressExpansion?.candidates?.length ?? 0) > 0;
}

function isLikelyMultiTenantTarget(t: SocialTarget): boolean {
  return t.addressExpansion?.classification?.isLikelyMultiTenant === true;
}

function matchesAggregatorType(t: SocialTarget, aggregatorTypeFilter: string): boolean {
  if (aggregatorTypeFilter === "all") return true;
  const rowType = t.addressExpansion?.classification?.aggregatorType;
  return (rowType ?? "unknown") === aggregatorTypeFilter;
}

function hasHighAddressDensity(t: SocialTarget): boolean {
  return (t.addressExpansion?.classification?.addressDensityScore ?? 0) >= 70;
}

function bestProspect(t: SocialTarget): { tier: "hot" | "warm" | "cold" | "exclude"; score: number } | null {
  const candidates = t.addressExpansion?.candidates ?? [];
  let best: { tier: "hot" | "warm" | "cold" | "exclude"; score: number } | null = null;
  for (const candidate of candidates) {
    const tier = candidate.prospect?.tier;
    const score = candidate.prospect?.readinessScore;
    if (!tier || typeof score !== "number" || !Number.isFinite(score)) continue;
    if (!best || score > best.score) best = { tier, score };
  }
  return best;
}

function hasHotProspect(t: SocialTarget): boolean {
  return bestProspect(t)?.tier === "hot" || (t.addressExpansion?.prospectCounts?.hot ?? 0) > 0;
}

function hasWarmOrBetterProspect(t: SocialTarget): boolean {
  const best = bestProspect(t);
  if (best) return best.tier === "hot" || best.tier === "warm";
  return (t.addressExpansion?.prospectCounts?.hot ?? 0) + (t.addressExpansion?.prospectCounts?.warm ?? 0) > 0;
}

function hasNonExcludedProspect(t: SocialTarget): boolean {
  const counts = t.addressExpansion?.prospectCounts;
  if (counts) return counts.hot + counts.warm + counts.cold > 0;
  return (t.addressExpansion?.candidates ?? []).some((candidate) => candidate.prospect?.tier !== "exclude");
}

function matchesVerificationStateFilter(t: SocialTarget, filter: "all" | VerificationState): boolean {
  if (filter === "all") return true;
  return getVerificationState(t) === filter;
}

function matchesCandidateTypeFilter(
  t: SocialTarget,
  filter: (typeof CANDIDATE_TYPE_FILTER)[number]
): boolean {
  if (filter === "all") return true;
  return (t.addressExpansion?.candidates ?? []).some((candidate) => candidate.prospect?.type === filter);
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

function formatCheckedAgo(iso?: string | null): string {
  if (!iso) return "not checked";
  try {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return "unknown";
    const diff = Date.now() - t;
    if (diff < 0) return "just now";
    const mins = Math.floor(diff / (60 * 1000));
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return "unknown";
  }
}

function toApiTarget(t: SocialTarget): SocialTarget {
  const n = normalizeSocialTarget({ ...t, handle: stripAt(t.handle) });
  const row: SocialTarget = {
    id: n.id,
    handle: stripAt(n.handle),
    zone: n.zone,
    category: n.category,
    status: n.status ?? "new",
    tags: n.tags ?? [],
  };
  if (n.businessName) row.businessName = n.businessName;
  if (n.notes) row.notes = n.notes;
  if (n.booking) row.booking = n.booking;
  if (typeof n.followers === "number") row.followers = n.followers;
  if (n.profileHealth) row.profileHealth = n.profileHealth;
  if (n.lastVerifiedAt) row.lastVerifiedAt = n.lastVerifiedAt;
  if (n.verificationNote) row.verificationNote = n.verificationNote;
  if (n.activitySignal) row.activitySignal = n.activitySignal;
  if (typeof n.priorityScore === "number") row.priorityScore = n.priorityScore;
  if (n.priorityScoreManual === true) row.priorityScoreManual = true;
  if (n.outreachAngle) row.outreachAngle = n.outreachAngle;
  if (n.socialProfile && Object.keys(n.socialProfile).length > 0) {
    row.socialProfile = { ...n.socialProfile };
  }
  if (n.socialCandidates?.length) {
    row.socialCandidates = n.socialCandidates.map((c) => ({ ...c }));
  }
  if (n.primaryCandidateId) row.primaryCandidateId = n.primaryCandidateId;
  if (n.evidence?.length) {
    row.evidence = n.evidence.map((ev) => ({
      ...ev,
      matchSignals: { ...ev.matchSignals },
      extracted: { ...ev.extracted },
    }));
  }
  if (n.platforms && Object.keys(n.platforms).length > 0) row.platforms = { ...n.platforms };
  if (typeof n.confidenceScore === "number") row.confidenceScore = n.confidenceScore;
  if (n.resolutionStatus) row.resolutionStatus = n.resolutionStatus;
  if (n.verificationState) row.verificationState = n.verificationState;
  if (n.runId) row.runId = n.runId;
  if (n.runType) row.runType = n.runType;
  if (n.sourceVersion) row.sourceVersion = n.sourceVersion;
  if (n.normalizedAddress) row.normalizedAddress = n.normalizedAddress;
  if (n.addressExpansion) {
    row.addressExpansion = {
      ...n.addressExpansion,
      ...(n.addressExpansion.classification ? { classification: { ...n.addressExpansion.classification } } : {}),
      ...(n.addressExpansion.candidates
        ? {
            candidates: n.addressExpansion.candidates.map((candidate) => ({
              ...candidate,
              evidenceIds: [...candidate.evidenceIds],
              ...(candidate.prospect
                ? {
                    prospect: {
                      ...candidate.prospect,
                      addressMatch: { ...candidate.prospect.addressMatch },
                    },
                  }
                : {}),
            })),
          }
        : {}),
    };
  }
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
  const [verificationStateFilter, setVerificationStateFilter] = useState<(typeof VERIFICATION_STATE_FILTER)[number]>("all");
  const [candidateTypeFilter, setCandidateTypeFilter] = useState<(typeof CANDIDATE_TYPE_FILTER)[number]>("all");
  const [minPriority, setMinPriority] = useState<(typeof MIN_PRIORITY_FILTER)[number]>("all");
  const [readyToAttackOnly, setReadyToAttackOnly] = useState(false);
  const [hideDeadProfiles, setHideDeadProfiles] = useState(true);
  const [viewMode, setViewMode] = useState<"primary" | "review">("primary");
  const [verifyBusyId, setVerifyBusyId] = useState<string | null>(null);
  const [revalidateBusyKey, setRevalidateBusyKey] = useState<string | null>(null);
  const [sourceIntakeBusyKey, setSourceIntakeBusyKey] = useState<string | null>(null);
  const [batchIngestBusy, setBatchIngestBusy] = useState(false);
  const [batchIngestInput, setBatchIngestInput] = useState("");
  const [batchIngestSummary, setBatchIngestSummary] = useState<BatchIngestSummary | null>(null);
  const [batchIngestResults, setBatchIngestResults] = useState<BatchIngestResult[] | null>(null);
  const [hotTagOnly, setHotTagOnly] = useState(false);
  const [referralHubsOnly, setReferralHubsOnly] = useState(false);
  const [hasInstagramOnly, setHasInstagramOnly] = useState(false);
  const [hasTikTokOnly, setHasTikTokOnly] = useState(false);
  const [hasLinktreeOnly, setHasLinktreeOnly] = useState(false);
  const [liveVerifiedOnly, setLiveVerifiedOnly] = useState(false);
  const [deadOnly, setDeadOnly] = useState(false);
  const [unverifiedOnly, setUnverifiedOnly] = useState(false);
  const [unknownOnly, setUnknownOnly] = useState(false);
  const [multiSignalOnly, setMultiSignalOnly] = useState(false);
  const [multiTenantOnly, setMultiTenantOnly] = useState(false);
  const [bookingEvidenceOnly, setBookingEvidenceOnly] = useState(false);
  const [addressExpansionOnly, setAddressExpansionOnly] = useState(false);
  const [highAddressDensityOnly, setHighAddressDensityOnly] = useState(false);
  const [aggregatorTypeFilter, setAggregatorTypeFilter] = useState<string>("all");
  const [hotProspectOnly, setHotProspectOnly] = useState(false);
  const [warmPlusOnly, setWarmPlusOnly] = useState(false);
  const [excludeHidden, setExcludeHidden] = useState(false);
  const [sortBy, setSortBy] = useState<
    | "operatorRank"
    | "name"
    | "zone"
    | "referredByCount"
    | "priorityScore"
    | "activitySignal"
    | "profileHealth"
    | "confidenceScore"
    | "evidenceCount"
    | "addressDensity"
    | "prospectScore"
  >("operatorRank");
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [bulkSummary, setBulkSummary] = useState<string | null>(null);
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

  const viewScopedTargets = useMemo(() => {
    if (viewMode === "primary") return targets.filter(shouldShowTargetInPrimaryView);
    return targets.filter(shouldShowTargetInReviewView);
  }, [targets, viewMode]);

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

  const aggregatorTypes = useMemo(() => {
    const out = new Set<string>(["unknown"]);
    for (const t of baseTargets) {
      const agg = t.addressExpansion?.classification?.aggregatorType;
      if (agg) out.add(agg);
    }
    return [...out].sort();
  }, [baseTargets]);

  const operatorKpis = useMemo(() => {
    const total = baseTargets.length;
    const activeProfiles = baseTargets.filter(isLiveVerified).length;
    const ready = baseTargets.filter((t) => isLiveVerified(t) && shouldShowTargetInPrimaryView(t)).length;
    const deadBroken = baseTargets.filter((t) => getVerificationState(t) === "dead").length;
    const liveProviders = baseTargets.filter(isLiveVerified).length;
    const primaryQueue = baseTargets.filter(shouldShowTargetInPrimaryView).length;
    const reviewQueue = baseTargets.filter(shouldShowTargetInReviewView).length;
    return { total, activeProfiles, ready, deadBroken, liveProviders, primaryQueue, reviewQueue };
  }, [baseTargets]);

  const topReadyTargets = useMemo(() => {
    return targets
      .filter((t) => {
        if (!isLiveVerified(t)) return false;
        if (viewMode === "primary" && !shouldShowTargetInPrimaryView(t)) return false;
        return true;
      })
      .sort((a, b) => compareTargetsByOperatorRank(a, b, true))
      .slice(0, 10)
      .map((x) => x);
  }, [targets, viewMode]);

  const topReferred = useMemo(() => {
    const raw = getTopReferredHandles(referralEdges).slice(0, 5);
    if (viewMode === "review") return raw;
    return raw.filter((n) => {
      const tgt = handleMatchesTarget(baseTargets, n.toHandle);
      if (!tgt) return true;
      return shouldShowTargetInPrimaryView(normalizeSocialTarget(tgt));
    });
  }, [referralEdges, viewMode, baseTargets]);

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
    let list = [...viewScopedTargets];
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
    list = list.filter((t) => matchesVerificationStateFilter(t, verificationStateFilter));
    list = list.filter((t) => matchesCandidateTypeFilter(t, candidateTypeFilter));
    if (minPriority !== "all") {
      list = list.filter((t) => (t.priorityScore ?? 0) >= minPriority);
    }
    if (readyToAttackOnly) list = list.filter(isLiveVerified);
    if (hideDeadProfiles) {
      list = list.filter((t) => !shouldHideTargetBecauseDead(t));
    }
    if (hotTagOnly) list = list.filter(hasHotTag);
    if (referralHubsOnly) list = list.filter((t) => t.isReferralHub);
    if (hasInstagramOnly) list = list.filter((t) => hasEvidencePlatform(t, "instagram"));
    if (hasTikTokOnly) list = list.filter((t) => hasEvidencePlatform(t, "tiktok"));
    if (hasLinktreeOnly) list = list.filter((t) => hasEvidencePlatform(t, "linktree"));
    if (liveVerifiedOnly) list = list.filter((t) => getVerificationState(t) === "live_verified");
    if (deadOnly) list = list.filter((t) => getVerificationState(t) === "dead");
    if (unverifiedOnly) {
      list = list.filter((t) => {
        const state = getVerificationState(t);
        return state === "unverified" || state === "matched" || state === "discovered";
      });
    }
    if (unknownOnly) list = list.filter(hasUnknownResolution);
    if (multiSignalOnly) list = list.filter(hasMultiSignal);
    if (multiTenantOnly) list = list.filter(isLikelyMultiTenantTarget);
    if (bookingEvidenceOnly) list = list.filter(hasBookingPlatformEvidence);
    if (addressExpansionOnly) list = list.filter(hasAddressExpansionCandidates);
    if (highAddressDensityOnly) list = list.filter(hasHighAddressDensity);
    list = list.filter((t) => matchesAggregatorType(t, aggregatorTypeFilter));
    if (hotProspectOnly) list = list.filter(hasHotProspect);
    if (warmPlusOnly) list = list.filter(hasWarmOrBetterProspect);
    if (excludeHidden) list = list.filter(hasNonExcludedProspect);

    const dir = sortDesc ? -1 : 1;
    list.sort((a, b) => {
      if (sortBy === "operatorRank") {
        return compareTargetsByOperatorRank(a, b, sortDesc);
      } else if (sortBy === "priorityScore") {
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
      } else if (sortBy === "confidenceScore") {
        const va = a.confidenceScore ?? 0;
        const vb = b.confidenceScore ?? 0;
        if (va !== vb) return (vb - va) * (sortDesc ? 1 : -1);
      } else if (sortBy === "evidenceCount") {
        const va = evidenceCount(a);
        const vb = evidenceCount(b);
        if (va !== vb) return (vb - va) * (sortDesc ? 1 : -1);
      } else if (sortBy === "addressDensity") {
        const va = a.addressExpansion?.classification?.addressDensityScore ?? 0;
        const vb = b.addressExpansion?.classification?.addressDensityScore ?? 0;
        if (va !== vb) return (vb - va) * (sortDesc ? 1 : -1);
      } else if (sortBy === "prospectScore") {
        const va = bestProspect(a)?.score ?? 0;
        const vb = bestProspect(b)?.score ?? 0;
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
    viewScopedTargets,
    search,
    zoneFilter,
    categoryFilter,
    statusFilter,
    profileHealthFilter,
    activityFilter,
    verificationStateFilter,
    candidateTypeFilter,
    minPriority,
    readyToAttackOnly,
    hideDeadProfiles,
    hotTagOnly,
    referralHubsOnly,
    hasInstagramOnly,
    hasTikTokOnly,
    hasLinktreeOnly,
    liveVerifiedOnly,
    deadOnly,
    unverifiedOnly,
    unknownOnly,
    multiSignalOnly,
    multiTenantOnly,
    bookingEvidenceOnly,
    addressExpansionOnly,
    highAddressDensityOnly,
    aggregatorTypeFilter,
    hotProspectOnly,
    warmPlusOnly,
    excludeHidden,
    sortBy,
    sortDesc,
  ]);

  const pipelineCounts = useMemo(() => {
    const loadedRows = targets.length;
    let stage = [...viewScopedTargets];
    const afterViewFilter = stage.length;
    if (zoneFilter !== "all") stage = stage.filter((t) => t.zone === zoneFilter);
    if (categoryFilter !== "all") stage = stage.filter((t) => t.category === categoryFilter);
    if (statusFilter !== "all") stage = stage.filter((t) => (t.status ?? "new") === statusFilter);
    stage = stage.filter((t) => matchesProfileHealthFilter(t, profileHealthFilter));
    stage = stage.filter((t) => matchesActivityFilter(t, activityFilter));
    const afterZoneCategoryStatusActivity = stage.length;
    stage = stage.filter((t) => matchesVerificationStateFilter(t, verificationStateFilter));
    stage = stage.filter((t) => matchesCandidateTypeFilter(t, candidateTypeFilter));
    if (minPriority !== "all") stage = stage.filter((t) => (t.priorityScore ?? 0) >= minPriority);
    if (readyToAttackOnly) stage = stage.filter(isLiveVerified);
    if (hideDeadProfiles) stage = stage.filter((t) => !shouldHideTargetBecauseDead(t));
    if (hotTagOnly) stage = stage.filter(hasHotTag);
    if (referralHubsOnly) stage = stage.filter((t) => t.isReferralHub);
    if (hasInstagramOnly) stage = stage.filter((t) => hasEvidencePlatform(t, "instagram"));
    if (hasTikTokOnly) stage = stage.filter((t) => hasEvidencePlatform(t, "tiktok"));
    if (hasLinktreeOnly) stage = stage.filter((t) => hasEvidencePlatform(t, "linktree"));
    if (liveVerifiedOnly) stage = stage.filter((t) => getVerificationState(t) === "live_verified");
    if (deadOnly) stage = stage.filter((t) => getVerificationState(t) === "dead");
    if (unverifiedOnly) stage = stage.filter((t) => {
      const state = getVerificationState(t);
      return state === "unverified" || state === "matched" || state === "discovered";
    });
    if (unknownOnly) stage = stage.filter(hasUnknownResolution);
    if (multiSignalOnly) stage = stage.filter(hasMultiSignal);
    if (multiTenantOnly) stage = stage.filter(isLikelyMultiTenantTarget);
    if (bookingEvidenceOnly) stage = stage.filter(hasBookingPlatformEvidence);
    if (addressExpansionOnly) stage = stage.filter(hasAddressExpansionCandidates);
    if (highAddressDensityOnly) stage = stage.filter(hasHighAddressDensity);
    stage = stage.filter((t) => matchesAggregatorType(t, aggregatorTypeFilter));
    if (hotProspectOnly) stage = stage.filter(hasHotProspect);
    if (warmPlusOnly) stage = stage.filter(hasWarmOrBetterProspect);
    if (excludeHidden) stage = stage.filter(hasNonExcludedProspect);
    const afterVerificationFilters = stage.length;
    const q = search.trim().toLowerCase();
    if (q) {
      stage = stage.filter((t) => {
        const h = stripAt(t.handle).toLowerCase();
        const n = (t.businessName ?? "").toLowerCase();
        return h.includes(q) || n.includes(q);
      });
    }
    const afterSearch = stage.length;
    return {
      loadedRows,
      afterViewFilter,
      afterZoneCategoryStatusActivity,
      afterVerificationFilters,
      afterSearch,
      finalRenderedRows: filteredSorted.length,
    };
  }, [
    targets,
    viewScopedTargets,
    zoneFilter,
    categoryFilter,
    statusFilter,
    profileHealthFilter,
    activityFilter,
    verificationStateFilter,
    candidateTypeFilter,
    minPriority,
    readyToAttackOnly,
    hideDeadProfiles,
    hotTagOnly,
    referralHubsOnly,
    hasInstagramOnly,
    hasTikTokOnly,
    hasLinktreeOnly,
    liveVerifiedOnly,
    deadOnly,
    unverifiedOnly,
    unknownOnly,
    multiSignalOnly,
    multiTenantOnly,
    bookingEvidenceOnly,
    addressExpansionOnly,
    highAddressDensityOnly,
    aggregatorTypeFilter,
    hotProspectOnly,
    warmPlusOnly,
    excludeHidden,
    search,
    filteredSorted.length,
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

  const selectedTargets = useMemo(
    () => filteredSorted.filter((t) => selectedIds.has(t.id)),
    [filteredSorted, selectedIds]
  );

  const runBulkVerify = useCallback(
    async (ids: string[], opts?: { allCandidates?: boolean; label?: string }) => {
      const cleanIds = [...new Set(ids.filter(Boolean))];
      if (!cleanIds.length) return;
      const label = opts?.label ?? "Verify";
      setBulkBusy(label);
      setBulkSummary(null);
      setSaveError(null);
      try {
        const res = await fetch("/api/social-targets/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetIds: cleanIds,
            ...(opts?.allCandidates ? { allCandidates: true } : {}),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          verified?: number;
        };
        if (!res.ok || data.ok !== true) {
          setSaveError(data.error || `${label} failed (${res.status})`);
          return;
        }
        setBulkSummary(`${label} complete: ${data.verified ?? 0} candidate checks`);
        router.refresh();
      } catch {
        setSaveError(`${label} failed (network)`);
      } finally {
        setBulkBusy(null);
      }
    },
    [router]
  );

  const runBulkRevalidate = useCallback(
    async (
      ids: string[],
      opts?: {
        mode?: "featured" | "all" | "selected" | "stale";
        candidateId?: string;
        label?: string;
        staleOnly?: boolean;
      }
    ) => {
      const cleanIds = [...new Set(ids.filter(Boolean))];
      const label = opts?.label ?? "Revalidate";
      if (!cleanIds.length && opts?.mode !== "stale") return;
      setBulkBusy(label);
      setBulkSummary(null);
      setSaveError(null);
      try {
        const res = await fetch("/api/social-targets/revalidate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(cleanIds.length ? { targetIds: cleanIds } : {}),
            ...(opts?.mode ? { mode: opts.mode } : {}),
            ...(opts?.candidateId ? { candidateId: opts.candidateId } : {}),
            ...(opts?.staleOnly ? { staleOnly: true } : {}),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          outcomes?: Array<{ candidateCount?: number }>;
        };
        if (!res.ok || data.ok !== true) {
          setSaveError(data.error || `${label} failed (${res.status})`);
          return;
        }
        const checked = (data.outcomes ?? []).reduce((sum, row) => sum + (row.candidateCount ?? 0), 0);
        setBulkSummary(`${label} complete: ${checked} candidate checks`);
        router.refresh();
      } catch {
        setSaveError(`${label} failed (network)`);
      } finally {
        setBulkBusy(null);
      }
    },
    [router]
  );

  const runBatchIngest = useCallback(async () => {
    if (!batchIngestInput.trim()) return;
    setBatchIngestBusy(true);
    setSaveError(null);
    setBatchIngestSummary(null);
    setBatchIngestResults(null);
    try {
      const parsed: unknown = JSON.parse(batchIngestInput);
      const payload =
        Array.isArray(parsed)
          ? { inputs: parsed, mode: "review_seed" }
          : typeof parsed === "object" && parsed !== null
            ? parsed
            : null;
      if (!payload) {
        setSaveError("Batch ingest input must be a JSON array or payload object.");
        return;
      }
      const res = await fetch("/api/social-targets/batch-ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        summary?: BatchIngestSummary;
        results?: BatchIngestResult[];
      };
      if (!res.ok || data.ok !== true || !data.summary) {
        setSaveError(data.error || `Batch ingest failed (${res.status})`);
        return;
      }
      setBatchIngestSummary(data.summary);
      setBatchIngestResults(data.results ?? []);
      setBulkSummary(
        `Batch ingest: ${data.summary.createdReviewCandidate} review-seeded, ${data.summary.attached} attached, ${data.summary.duplicates + data.summary.alreadyPresent} duplicate/already, ${data.summary.suppressed + data.summary.rejected} suppressed/rejected`
      );
      router.refresh();
    } catch {
      setSaveError("Batch ingest failed: invalid JSON or network error");
    } finally {
      setBatchIngestBusy(false);
    }
  }, [batchIngestInput, router]);

  const applyBulkOperationalState = useCallback(
    (patch: Partial<NonNullable<SocialTarget["socialProfile"]>>, summary: string) => {
      if (selectedTargets.length === 0) return;
      const ids = new Set(selectedTargets.map((t) => t.id));
      setBaseTargets((prev) => {
        const next = prev.map((x) => (ids.has(x.id) ? patchSocialProfile(x, patch) : x));
        void persistTargetsList(next);
        return next;
      });
      setBulkSummary(summary);
    },
    [persistTargetsList, selectedTargets]
  );

  const bulkPromoteBestFeatured = useCallback(() => {
    if (selectedTargets.length === 0) return;
    const ids = new Set(selectedTargets.map((t) => t.id));
    setBaseTargets((prev) => {
      const next = prev.map((x) => {
        if (!ids.has(x.id)) return x;
        const bestId = pickBestFeaturedCandidateId(x);
        if (!bestId) return x;
        return normalizeSocialTarget(setPrimaryCandidateId(ensureSocialCandidates(x), bestId));
      });
      void persistTargetsList(next);
      return next;
    });
    setBulkSummary("Promoted best featured candidate for selected rows");
  }, [persistTargetsList, selectedTargets]);

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
          const stepped = afterHealthOrActivityChange(t, {
            profileHealth: health,
            lastVerifiedAt: new Date().toISOString(),
          });
          return patchSocialProfile(stepped, { resolveStatus: mapProfileHealthToResolveStatus(health) });
        });
        void persistTargetsList(next);
        return next;
      });
    },
    [persistTargetsList]
  );

  const applySocialProfilePatch = useCallback(
    (id: string, patch: Partial<NonNullable<SocialTarget["socialProfile"]>>) => {
      setBaseTargets((prev) => {
        const next = prev.map((x) => (x.id === id ? patchSocialProfile(x, patch) : x));
        void persistTargetsList(next);
        return next;
      });
    },
    [persistTargetsList]
  );

  const runHeadVerify = useCallback(
    async (t: SocialTarget) => {
      const primary = getPrimaryCandidate(ensureSocialCandidates(t));
      setVerifyBusyId(t.id);
      setSaveError(null);
      try {
        const res = await fetch("/api/social-targets/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetId: t.id,
            ...(primary?.id ? { candidateId: primary.id } : {}),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || data.ok !== true) {
          setSaveError(data.error || `Verify failed (${res.status})`);
          return;
        }
        router.refresh();
      } catch {
        setSaveError("Verify failed (network)");
      } finally {
        setVerifyBusyId(null);
      }
    },
    [router]
  );

  const runRowRevalidate = useCallback(
    async (t: SocialTarget, mode: "featured" | "all") => {
      const key = `${mode}:${t.id}`;
      setRevalidateBusyKey(key);
      setSaveError(null);
      try {
        const endpoint =
          mode === "all"
            ? `/api/social-targets/${encodeURIComponent(t.id)}/revalidate-all`
            : `/api/social-targets/${encodeURIComponent(t.id)}/revalidate-featured`;
        const res = await fetch(endpoint, { method: "POST" });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || data.ok !== true) {
          setSaveError(data.error || `Revalidate failed (${res.status})`);
          return;
        }
        router.refresh();
      } catch {
        setSaveError("Revalidate failed (network)");
      } finally {
        setRevalidateBusyKey(null);
      }
    },
    [router]
  );

  const postPrimaryCandidatePatch = useCallback(
    async (targetId: string, candidateId: string, patch: Record<string, unknown>) => {
      setSaveError(null);
      try {
        const res = await fetch(`/api/social-targets/${encodeURIComponent(targetId)}/candidate/${encodeURIComponent(candidateId)}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || data.ok !== true) {
          setSaveError(data.error || `Update failed (${res.status})`);
          return;
        }
        router.refresh();
      } catch {
        setSaveError("Update failed (network)");
      }
    },
    [router]
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

  const onFindSocial = useCallback(
    (t: SocialTarget) => {
      const stamp = new Date().toISOString().slice(0, 10);
      setBaseTargets((prev) => {
        const next = prev.map((x) => {
          if (x.id !== t.id) return x;
          const seed = "Find social requested";
          const existing = (x.verificationNote ?? "").trim();
          const nextNote = existing.includes(seed) ? existing : existing ? `${existing} | ${seed} (${stamp})` : `${seed} (${stamp})`;
          return { ...x, verificationNote: nextNote };
        });
        void persistTargetsList(next);
        return next;
      });
      void runHeadVerify(t);
    },
    [persistTargetsList, runHeadVerify]
  );

  const runAddressExpansionForRow = useCallback(
    async (t: SocialTarget) => {
      const key = `address-expansion:${t.id}`;
      setBulkBusy(key);
      setSaveError(null);
      try {
        const res = await fetch("/api/social-targets/address-expansion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetIds: [t.id],
            runType: "adhoc",
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          outcomes?: Array<{ targetId: string; candidatesStaged?: number; queryCount?: number; isLikelyMultiTenant?: boolean }>;
        };
        if (!res.ok || data.ok !== true) {
          setSaveError(data.error || `Address expansion failed (${res.status})`);
          return;
        }
        const first = data.outcomes?.[0];
        setBulkSummary(
          `Address expansion: ${first?.queryCount ?? 0} queries, ${first?.candidatesStaged ?? 0} staged candidates${
            first?.isLikelyMultiTenant ? ", multi-tenant likely" : ""
          }`
        );
        router.refresh();
      } catch {
        setSaveError("Address expansion failed (network)");
      } finally {
        setBulkBusy(null);
      }
    },
    [router]
  );

  const applySourceIntakeAction = useCallback(
    async (
      targetId: string,
      input: SourceCandidateInput,
      action: "accept" | "reject" | "verify" | "hide"
    ) => {
      const busyKey = `${targetId}:${input.sourceType}:${input.rawSourceId ?? input.profileUrl ?? input.handle ?? "source"}`;
      setSourceIntakeBusyKey(busyKey);
      setSaveError(null);
      let verifyTargetId: string | null = null;
      let verifyCandidateId: string | null = null;

      setBaseTargets((prev) => {
        const next = prev.map((row) => {
          if (row.id !== targetId) return row;
          let normalized = normalizeSocialTarget(row);
          normalized = ingestSourceCandidateInputs(normalized, [input]);
          const preview = sourceCandidateInputToSocialCandidate(normalized, input);
          const key = socialCandidateIdentityKeyForIntake(preview);
          const matched = (normalized.socialCandidates ?? []).find(
            (c) => c.id === preview.id || socialCandidateIdentityKeyForIntake(c) === key
          );
          if (!matched) return normalized;
          if (action === "accept") return normalized;
          if (action === "reject") {
            return normalizeSocialTarget(
              patchCandidate(normalized, matched.id, {
                verificationStatus: "rejected",
                visibilityState: "hide",
                notes: [matched.notes, "Rejected from source intake"].filter(Boolean).join(" | "),
              })
            );
          }
          if (action === "hide") {
            return normalizeSocialTarget(
              patchCandidate(normalized, matched.id, {
                visibilityState: "hide",
                notes: [matched.notes, "Hidden from source intake"].filter(Boolean).join(" | "),
              })
            );
          }
          verifyTargetId = normalized.id;
          verifyCandidateId = matched.id;
          return normalized;
        });
        void persistTargetsList(next);
        return next;
      });

      if (action === "verify" && verifyTargetId && verifyCandidateId) {
        try {
          const res = await fetch("/api/social-targets/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetId: verifyTargetId, candidateId: verifyCandidateId }),
          });
          const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
          if (!res.ok || data.ok !== true) {
            setSaveError(data.error || `Verify failed (${res.status})`);
          } else {
            router.refresh();
          }
        } catch {
          setSaveError("Verify failed (network)");
        }
      }

      setSourceIntakeBusyKey(null);
    },
    [persistTargetsList, router]
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
      const next = [...prev, patchSocialProfile(row, { discoverySource: "referral" })];
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
      {bulkSummary ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">{bulkSummary}</div>
      ) : null}

      <details className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
        <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wide text-neutral-600">
          Batch source ingest (normalized inputs)
        </summary>
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-neutral-600">
            Paste normalized source inputs as JSON array or payload object. Batch ingest seeds review queue without silent promotion.
          </p>
          <textarea
            value={batchIngestInput}
            onChange={(e) => setBatchIngestInput(e.target.value)}
            rows={5}
            placeholder='{"mode":"review_seed","sourceBatchLabel":"maps-import-2026-04-05","inputs":[...]}'
            className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-[11px] text-neutral-800"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={batchIngestBusy || !batchIngestInput.trim()}
              onClick={() => void runBatchIngest()}
              className="rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"
            >
              {batchIngestBusy ? "Ingesting..." : "Run batch ingest"}
            </button>
            {batchIngestSummary ? (
              <span className="text-[11px] text-neutral-700">
                Processed {batchIngestSummary.totalProcessed}: seeded {batchIngestSummary.createdReviewCandidate}, attached{" "}
                {batchIngestSummary.attached}, duplicate/already {batchIngestSummary.duplicates + batchIngestSummary.alreadyPresent},
                suppressed/rejected {batchIngestSummary.suppressed + batchIngestSummary.rejected}, skipped {batchIngestSummary.skipped}
              </span>
            ) : null}
          </div>
          {batchIngestResults && batchIngestResults.length > 0 ? (
            <div className="max-h-44 overflow-auto rounded border border-neutral-200 bg-white p-2">
              <ul className="space-y-1 text-[10px] text-neutral-700">
                {batchIngestResults.slice(0, 80).map((r, i) => (
                  <li key={`${r.sourceType}:${r.candidateKey ?? i}`} className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-neutral-100 px-1 py-0.5 font-semibold uppercase">{r.sourceType}</span>
                    <span className="rounded bg-slate-100 px-1 py-0.5">{r.outcome}</span>
                    {r.targetId ? <span>target:{r.targetId}</span> : null}
                    {r.reason ? <span className="text-neutral-500">({r.reason})</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm">
        <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">View</span>
        <button
          type="button"
          onClick={() => setViewMode("primary")}
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
            viewMode === "primary" ? "bg-emerald-600 text-white" : "border border-neutral-200 bg-neutral-50 text-neutral-700"
          }`}
        >
          Primary
        </button>
        <button
          type="button"
          onClick={() => setViewMode("review")}
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
            viewMode === "review" ? "bg-amber-600 text-white" : "border border-neutral-200 bg-neutral-50 text-neutral-700"
          }`}
        >
          Review
        </button>
        <span className="text-[11px] text-neutral-500">
          Primary = live / trusted queue. Review = dead, hidden, rejected, or explicit review bucket.
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg border border-slate-200 bg-slate-50/90 px-2.5 py-1.5 shadow-sm">
          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-600">Primary queue</p>
          <p className="text-lg font-bold tabular-nums text-slate-950">{operatorKpis.primaryQueue}</p>
        </div>
        {operatorKpis.reviewQueue > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-2.5 py-1.5 shadow-sm">
            <p className="text-[9px] font-bold uppercase tracking-wide text-amber-900">Review queue</p>
            <p className="text-lg font-bold tabular-nums text-amber-950">{operatorKpis.reviewQueue}</p>
          </div>
        ) : null}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 px-2.5 py-1.5 shadow-sm">
          <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-800">Active (live verified)</p>
          <p className="text-lg font-bold tabular-nums text-emerald-950">{operatorKpis.activeProfiles}</p>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50/90 px-2.5 py-1.5 shadow-sm">
          <p className="text-[9px] font-bold uppercase tracking-wide text-rose-900">Ready (live verified)</p>
          <p className="text-lg font-bold tabular-nums text-rose-950">{operatorKpis.ready}</p>
        </div>
        {operatorKpis.deadBroken > 0 ? (
          <div className="rounded-lg border border-neutral-300 bg-neutral-100/90 px-2.5 py-1.5 shadow-sm">
            <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-600">Dead / broken</p>
            <p className="text-lg font-bold tabular-nums text-neutral-900">{operatorKpis.deadBroken}</p>
          </div>
        ) : null}
        {operatorKpis.liveProviders > 0 ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50/90 px-2.5 py-1.5 shadow-sm">
            <p className="text-[9px] font-bold uppercase tracking-wide text-sky-900">Live verified</p>
            <p className="text-lg font-bold tabular-nums text-sky-950">{operatorKpis.liveProviders}</p>
          </div>
        ) : null}
      </div>

      <details className="rounded-lg border border-neutral-200 bg-neutral-50/80 p-2.5">
        <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wide text-neutral-600">
          More metrics
        </summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 shadow-sm">
            <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Targets</p>
            <p className="text-lg font-bold tabular-nums text-neutral-950">{baseTargets.length}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 shadow-sm">
            <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Shown</p>
            <p className="text-lg font-bold tabular-nums text-neutral-950">{filteredSorted.length}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 shadow-sm">
            <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Selected</p>
            <p className="text-lg font-bold tabular-nums text-neutral-950">{selectedIds.size}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 shadow-sm">
            <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Zones</p>
            <p className="text-lg font-bold tabular-nums text-neutral-950">{zones.length}</p>
          </div>
          {referralSummary.totalEdges > 0 ? (
            <>
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/80 px-2.5 py-1.5">
                <p className="text-[9px] font-bold uppercase tracking-wide text-indigo-900">Referral edges</p>
                <p className="text-lg font-bold tabular-nums text-indigo-950">{referralSummary.totalEdges}</p>
              </div>
              <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/80 px-2.5 py-1.5">
                <p className="text-[9px] font-bold uppercase tracking-wide text-fuchsia-900">Multi-confidence</p>
                <p className="text-lg font-bold tabular-nums text-fuchsia-950">{referralSummary.multiEdges}</p>
              </div>
              <div className="rounded-lg border border-teal-200 bg-teal-50/80 px-2.5 py-1.5">
                <p className="text-[9px] font-bold uppercase tracking-wide text-teal-900">Referral hubs</p>
                <p className="text-lg font-bold tabular-nums text-teal-950">{referralSummary.hubCount}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-1.5">
                <p className="text-[9px] font-bold uppercase tracking-wide text-amber-900">Top referred</p>
                <p className="text-[11px] font-semibold text-amber-950">
                  {referralSummary.topHandle ? (
                    <>
                      @{referralSummary.topHandle}{" "}
                      <span className="text-[10px] font-normal text-amber-800">({referralSummary.topSeen}×)</span>
                    </>
                  ) : (
                    <span className="text-neutral-500">—</span>
                  )}
                </p>
              </div>
            </>
          ) : null}
        </div>
      </details>

      {viewMode === "primary" && topReadyTargets.length > 0 ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50/30 p-2.5">
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-rose-900">Top ready targets</h2>
          <p className="mt-0.5 text-[11px] text-neutral-600">
            Verified/live rows with operator rank preference: trust, validity, confidence, then activity.
          </p>
          <ul className="mt-2 space-y-1.5">
            {topReadyTargets.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rose-100 bg-white px-2.5 py-1.5 text-[11px]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <TargetHandleLink t={t}>
                      @{displayHandleForTarget(t)}
                    </TargetHandleLink>
                    <span className="text-neutral-500">{t.category}</span>
                    <span className="font-bold tabular-nums text-neutral-800">{getEffectivePriorityScore(t)}</span>
                  </div>
                  {t.outreachAngle ? (
                    <p className="mt-0.5 max-w-md truncate text-[10px] text-neutral-600">{t.outreachAngle}</p>
                  ) : null}
                </div>
                {!shouldHideTargetBecauseDead(t) ? (
                  <a
                    href={profileUrlForTarget(t)}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[9px] font-bold uppercase text-rose-900 hover:bg-rose-100"
                  >
                    Open profile
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {topReferred.length > 0 ? (
        <details className="rounded-lg border border-neutral-200 bg-neutral-50/70 p-2.5">
          <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wide text-neutral-600">
            Emerging referral nodes
          </summary>
          <p className="mt-1 text-[11px] text-neutral-500">Top referred handles by category (includes handles not yet in the target list).</p>
          <ul className="mt-2 space-y-1.5">
            {topReferred.map((n) => {
              const known = isKnownReferredNode(n.toHandle);
              return (
                <li
                  key={`${n.toHandle}::${n.category}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px]"
                >
                  <div>
                    <span className="font-semibold text-neutral-900">@{n.toHandle}</span>
                    <span className="ml-2 rounded bg-neutral-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-neutral-600">
                      {n.category}
                    </span>
                    <span className="ml-2 tabular-nums text-neutral-600">{n.timesSeen}×</span>
                    <span
                      className={`ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
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
                      className="rounded-full border border-neutral-300 bg-neutral-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-neutral-800 hover:bg-white"
                    >
                      Promote to target
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-neutral-200 bg-neutral-50/80 p-2">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Search
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Handle or business"
            className="mt-0.5 block w-40 rounded border border-neutral-300 bg-white px-2 py-1 text-[11px]"
          />
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Zone
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="mt-0.5 block max-w-[11rem] rounded border border-neutral-300 bg-white px-2 py-1 text-[11px]"
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
            className="mt-0.5 block max-w-[9.5rem] rounded border border-neutral-300 bg-white px-2 py-1 text-[11px]"
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
            className="mt-0.5 block rounded border border-neutral-300 bg-white px-2 py-1 text-[11px]"
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
          Activity
          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value as (typeof ACTIVITY_FILTER)[number])}
            className="mt-0.5 block rounded border border-neutral-300 bg-white px-2 py-1 text-[11px]"
          >
            {ACTIVITY_FILTER.map((f) => (
              <option key={f} value={f}>
                {f === "all" ? "All" : f}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Verification
          <select
            value={verificationStateFilter}
            onChange={(e) => setVerificationStateFilter(e.target.value as (typeof VERIFICATION_STATE_FILTER)[number])}
            className="mt-0.5 block rounded border border-neutral-300 bg-white px-2 py-1 text-[11px]"
          >
            {VERIFICATION_STATE_FILTER.map((v) => (
              <option key={v} value={v}>
                {v === "all" ? "All" : v.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Candidate type
          <select
            value={candidateTypeFilter}
            onChange={(e) => setCandidateTypeFilter(e.target.value as (typeof CANDIDATE_TYPE_FILTER)[number])}
            className="mt-0.5 block rounded border border-neutral-300 bg-white px-2 py-1 text-[11px]"
          >
            {CANDIDATE_TYPE_FILTER.map((v) => (
              <option key={v} value={v}>
                {v === "all" ? "All" : v.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Sort
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as
                  | "operatorRank"
                  | "name"
                  | "zone"
                  | "referredByCount"
                  | "priorityScore"
                  | "activitySignal"
                  | "profileHealth"
                  | "confidenceScore"
                  | "evidenceCount"
                  | "addressDensity"
                  | "prospectScore"
              )
            }
            className="mt-0.5 block max-w-[11rem] rounded border border-neutral-300 bg-white px-2 py-1 text-[11px]"
          >
            <option value="operatorRank">Operator rank</option>
            <option value="priorityScore">Priority score</option>
            <option value="confidenceScore">Confidence</option>
            <option value="evidenceCount">Evidence count</option>
            <option value="addressDensity">Address density</option>
            <option value="prospectScore">Prospect score</option>
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
      </div>

      <details className="rounded-lg border border-neutral-200 bg-neutral-50/80 p-2.5">
        <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wide text-neutral-600">
          More filters & bulk actions
        </summary>
        <div className="mt-2 flex flex-wrap items-end gap-2">
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
            Min priority
            <select
              value={minPriority === "all" ? "all" : String(minPriority)}
              onChange={(e) => {
                const v = e.target.value;
                setMinPriority(v === "all" ? "all" : (Number(v) as 50 | 70 | 80));
              }}
              className="mt-0.5 block rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
            >
              {MIN_PRIORITY_FILTER.map((value) => (
                <option key={String(value)} value={value === "all" ? "all" : String(value)}>
                  {value === "all" ? "All" : `${value}+`}
                </option>
              ))}
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
          <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
            <input
              type="checkbox"
              checked={hasInstagramOnly}
              onChange={(e) => setHasInstagramOnly(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Has IG evidence
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
            <input
              type="checkbox"
              checked={hasTikTokOnly}
              onChange={(e) => setHasTikTokOnly(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Has TikTok evidence
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
            <input
              type="checkbox"
              checked={hasLinktreeOnly}
              onChange={(e) => setHasLinktreeOnly(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Has Linktree evidence
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
            <input
              type="checkbox"
              checked={liveVerifiedOnly}
              onChange={(e) => setLiveVerifiedOnly(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Live verified only
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
            <input
              type="checkbox"
              checked={deadOnly}
              onChange={(e) => setDeadOnly(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Dead only
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
            <input
              type="checkbox"
              checked={unverifiedOnly}
              onChange={(e) => setUnverifiedOnly(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Unverified only
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
            <input
              type="checkbox"
              checked={unknownOnly}
              onChange={(e) => setUnknownOnly(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Unknown only
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
            <input
              type="checkbox"
              checked={multiSignalOnly}
              onChange={(e) => setMultiSignalOnly(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Multi-signal only
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
            <input
              type="checkbox"
              checked={multiTenantOnly}
              onChange={(e) => setMultiTenantOnly(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Likely multi-tenant
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
            <input
              type="checkbox"
              checked={bookingEvidenceOnly}
              onChange={(e) => setBookingEvidenceOnly(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Has booking evidence
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
            <input
              type="checkbox"
              checked={addressExpansionOnly}
              onChange={(e) => setAddressExpansionOnly(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Address expansion candidates
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
            <input
              type="checkbox"
              checked={highAddressDensityOnly}
              onChange={(e) => setHighAddressDensityOnly(e.target.checked)}
              className="rounded border-neutral-300"
            />
            High address density
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
            <input
              type="checkbox"
              checked={hotProspectOnly}
              onChange={(e) => setHotProspectOnly(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Hot prospects only
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
            <input
              type="checkbox"
              checked={warmPlusOnly}
              onChange={(e) => setWarmPlusOnly(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Warm+ only
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
            <input
              type="checkbox"
              checked={excludeHidden}
              onChange={(e) => setExcludeHidden(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Exclude hidden
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Aggregator
            <select
              value={aggregatorTypeFilter}
              onChange={(e) => setAggregatorTypeFilter(e.target.value)}
              className="mt-0.5 block rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
            >
              <option value="all">All</option>
              {aggregatorTypes.map((agg) => (
                <option key={agg} value={agg}>
                  {agg.replace(/_/g, " ")}
                </option>
              ))}
            </select>
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
            <button
              type="button"
              disabled={selectedTargets.length === 0 || bulkBusy !== null}
              onClick={() => void runBulkVerify(selectedTargets.map((t) => t.id), { label: "Verify selected" })}
              className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-sky-900 hover:bg-sky-100 disabled:opacity-50"
            >
              {bulkBusy === "Verify selected" ? "Verifying..." : "Verify selected"}
            </button>
            <button
              type="button"
              disabled={filteredSorted.length === 0 || bulkBusy !== null}
              onClick={() => void runBulkVerify(filteredSorted.map((t) => t.id), { label: "Verify visible" })}
              className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-sky-900 hover:bg-sky-100 disabled:opacity-50"
            >
              {bulkBusy === "Verify visible" ? "Verifying..." : "Verify visible"}
            </button>
            <button
              type="button"
              disabled={selectedTargets.length === 0 || bulkBusy !== null}
              onClick={() =>
                void runBulkVerify(selectedTargets.map((t) => t.id), {
                  label: "Verify selected (all candidates)",
                  allCandidates: true,
                })
              }
              className="rounded-full border border-sky-400 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-sky-900 hover:bg-sky-50 disabled:opacity-50"
            >
              {bulkBusy === "Verify selected (all candidates)" ? "Verifying..." : "Verify selected all"}
            </button>
            <button
              type="button"
              disabled={selectedTargets.length === 0 || bulkBusy !== null}
              onClick={() =>
                void runBulkRevalidate(selectedTargets.map((t) => t.id), {
                  mode: "all",
                  label: "Revalidate selected",
                })
              }
              className="rounded-full border border-violet-300 bg-violet-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-900 hover:bg-violet-100 disabled:opacity-50"
            >
              {bulkBusy === "Revalidate selected" ? "Revalidating..." : "Revalidate selected"}
            </button>
            <button
              type="button"
              disabled={bulkBusy !== null}
              onClick={() =>
                void runBulkRevalidate([], {
                  mode: "stale",
                  staleOnly: true,
                  label: "Revalidate stale",
                })
              }
              className="rounded-full border border-violet-300 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-900 hover:bg-violet-50 disabled:opacity-50"
            >
              {bulkBusy === "Revalidate stale" ? "Revalidating..." : "Revalidate stale"}
            </button>
            <button
              type="button"
              disabled={selectedTargets.length === 0}
              onClick={() =>
                applyBulkOperationalState(
                  { verificationStatus: "candidate", visibilityState: "review" },
                  "Sent selected rows to review"
                )
              }
              className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-950 hover:bg-amber-100 disabled:opacity-50"
            >
              Send selected to review
            </button>
            <button
              type="button"
              disabled={selectedTargets.length === 0}
              onClick={() => applyBulkOperationalState({ visibilityState: "hide" }, "Hidden selected rows")}
              className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-rose-900 hover:bg-rose-100 disabled:opacity-50"
            >
              Hide selected
            </button>
            <button
              type="button"
              disabled={selectedTargets.length === 0}
              onClick={bulkPromoteBestFeatured}
              className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
            >
              Promote best featured
            </button>
          </div>
        </div>
      </details>

      {process.env.NODE_ENV !== "production" ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-2.5 py-1.5 text-[10px] text-neutral-700">
          Pipeline: loaded {pipelineCounts.loadedRows} · view {pipelineCounts.afterViewFilter} · zone/cat/status/activity{" "}
          {pipelineCounts.afterZoneCategoryStatusActivity} · verification/prospect {pipelineCounts.afterVerificationFilters} · search{" "}
          {pipelineCounts.afterSearch} · render {pipelineCounts.finalRenderedRows}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
              <th className="w-10 px-2 py-2">Sel</th>
              <th className="px-2 py-2">Target summary & actions</th>
            </tr>
          </thead>
          <tbody className="text-neutral-800">
            {filteredSorted.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-3 py-8 text-center text-sm text-neutral-500">
                  No targets match filters.
                </td>
              </tr>
            ) : (
              filteredSorted.map((t) => {
                const draft = getDraft(t.id);
                const outgoing = t.referralCount ?? 0;
                const incoming = t.referredByCount ?? 0;
                const score = t.priorityScore ?? 0;
                const baseRow = baseTargets.find((b) => b.id === t.id) ?? t;
                const verificationState = getVerificationState(baseRow);
                const ready = verificationState === "live_verified";
                const rowEnsured = ensureSocialCandidates(baseRow);
                const rowCandidates = rowEnsured.socialCandidates ?? [];
                const featured = getPrimaryCandidate(rowEnsured);
                const primarySelectValue = baseRow.primaryCandidateId ?? rowCandidates[0]?.id ?? "";
                const alternateCount = featured ? Math.max(0, rowCandidates.length - 1) : rowCandidates.length;
                const state = getPrimaryOperationalState(baseRow);
                const rank = computeOperatorDisplayRank(baseRow);
                const betterAlt = featuredWeakerThanBestAlternate(baseRow);
                const prospect = bestProspect(baseRow);
                const featuredIntegrity = getFeaturedValidationIntegrity(baseRow);
                const confirmedNoSocial = isConfirmedRealNoSocial(baseRow);
                const featuredCandidate = featuredIntegrity.displayCandidate;
                const featuredCheckedAgo = formatCheckedAgo(featuredCandidate?.lastCheckedAt ?? featuredCandidate?.lastVerifiedAt ?? null);
                const featuredReason =
                  featuredIntegrity.featuredCandidateId && featuredCandidate?.id !== featuredIntegrity.featuredCandidateId
                    ? "fallback to best valid featured candidate"
                    : featuredCandidate?.id === featuredIntegrity.featuredCandidateId
                      ? "operator-selected featured candidate"
                      : "best valid featured candidate";
                const recommendedAngle =
                  t.outreachAngle ||
                  (featuredIntegrity.needsRecheck
                    ? "Recheck featured profile before treating as live truth"
                    : confirmedNoSocial
                      ? noSocialFallbackAngle(baseRow)
                      : "No outreach angle yet");
                const sourceIntake = buildSourceIntakeInputsForTarget(baseRow).map((input) => ({
                  input,
                  ...classifySourceCandidate(baseRow, input),
                }));
                const addressExpansion = baseRow.addressExpansion;
                const addressClass = addressExpansion?.classification;
                const addressCandidateCount = addressExpansion?.candidateCount ?? addressExpansion?.candidates?.length ?? 0;
                const isAddressMultiTenant = addressClass?.isLikelyMultiTenant === true;
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
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(320px,1.15fr)_minmax(230px,0.78fr)_minmax(210px,0.62fr)]">
                        <div className="min-w-0 space-y-2 md:col-span-2 lg:col-span-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <TargetHandleLink t={t}>
                              <span className="text-[15px] font-semibold text-neutral-900">@{displayHandleForTarget(t)}</span>
                            </TargetHandleLink>
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-amber-950">
                              {score}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                                ready ? "bg-rose-600 text-white" : "bg-neutral-200 text-neutral-700"
                              }`}
                            >
                              {ready ? "READY" : state.replace(/_/g, " ")}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                verificationState === "live_verified"
                                  ? "bg-emerald-100 text-emerald-900"
                                  : verificationState === "dead"
                                    ? "bg-rose-100 text-rose-900"
                                    : verificationState === "rejected"
                                      ? "bg-neutral-300 text-neutral-800"
                                      : verificationState === "matched"
                                        ? "bg-sky-100 text-sky-900"
                                        : verificationState === "unverified"
                                          ? "bg-amber-100 text-amber-900"
                                          : "bg-neutral-100 text-neutral-700"
                              }`}
                            >
                              {verificationState.replace(/_/g, " ")}
                            </span>
                            {confirmedNoSocial ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950">
                                NO SOCIAL
                              </span>
                            ) : null}
                            {score >= 80 ? (
                              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-950">80+</span>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-800">
                            <span className="font-medium text-neutral-900">{t.businessName || "—"}</span>
                            <span className="text-neutral-400">•</span>
                            <span>{t.zone}</span>
                            <span className="text-neutral-400">•</span>
                            <span>{t.category}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <TrustBadges t={t} />
                            {hasHotTag(t) ? (
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-900">
                                HOT
                              </span>
                            ) : null}
                            {alternateCount > 0 ? (
                              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-900">
                                +{alternateCount} alt
                              </span>
                            ) : null}
                            {betterAlt ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950">
                                stronger alt exists
                              </span>
                            ) : null}
                            {isAddressMultiTenant ? (
                              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-900">
                                multi-tenant
                              </span>
                            ) : null}
                            {addressClass?.aggregatorType ? (
                              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-900">
                                {addressClass.aggregatorType.replace(/_/g, " ")}
                              </span>
                            ) : null}
                            {addressCandidateCount > 0 ? (
                              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-900">
                                addr candidates {addressCandidateCount}
                              </span>
                            ) : null}
                            {prospect ? (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  prospect.tier === "hot"
                                    ? "bg-rose-100 text-rose-900"
                                    : prospect.tier === "warm"
                                      ? "bg-amber-100 text-amber-900"
                                      : prospect.tier === "cold"
                                        ? "bg-neutral-200 text-neutral-700"
                                        : "bg-neutral-100 text-neutral-500"
                                }`}
                              >
                                {prospect.tier}
                              </span>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-neutral-700">
                            <span>
                              Health: <span className="font-semibold text-neutral-900">{t.profileHealth ?? "—"}</span>
                            </span>
                            <span>
                              Activity: <span className="font-semibold text-neutral-900">{t.activitySignal ?? "—"}</span>
                            </span>
                            <span>
                              Resolution: <span className="font-semibold text-neutral-900">{(t.resolutionStatus ?? "unknown").replace(/_/g, " ")}</span>
                            </span>
                            <span>
                              Evidence: <span className="font-semibold tabular-nums text-neutral-900">{evidenceCount(t)}</span>
                            </span>
                            <span>
                              Confidence: <span className="font-semibold tabular-nums text-neutral-900">{t.confidenceScore ?? "—"}</span>
                            </span>
                            <span>
                              Addr density:{" "}
                              <span className="font-semibold tabular-nums text-neutral-900">
                                {addressClass?.addressDensityScore ?? "—"}
                              </span>
                            </span>
                            <span>
                              Prospect:{" "}
                              <span className="font-semibold tabular-nums text-neutral-900">
                                {prospect ? `${prospect.tier} ${prospect.score}` : "—"}
                              </span>
                            </span>
                            <span>
                              Score: <span className="font-bold tabular-nums text-neutral-900">{score}</span>
                              {baseRow.priorityScoreManual ? <span className="ml-1 text-[11px] text-neutral-500">(manual)</span> : null}
                            </span>
                          </div>

                          <div className="text-[12px] text-neutral-600">
                            <SocialTargetEvidence target={baseRow} />
                          </div>

                          <div className="text-[13px] font-medium text-neutral-900">
                            {recommendedAngle}
                          </div>
                          {featuredIntegrity.needsRecheck ? (
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                              Verify needed: {featuredIntegrity.reason}
                            </div>
                          ) : null}

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
                            <span>Verified {formatVerifiedAt(t.lastVerifiedAt)}</span>
                            <span>
                              Queue v{rank.verificationRank} r{rank.resolveRank} t{rank.tierRank}
                            </span>
                            {t.tags?.map((tag) => (
                              <span key={tag} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="min-w-0 space-y-2">
                          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">System proof</p>
                            <div className="mt-1 grid gap-1 text-[10px] text-neutral-700">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span>Checked: <span className="font-semibold text-neutral-900">{featuredCheckedAgo}</span></span>
                                <span>Resolve: <span className="font-semibold text-neutral-900">{featuredIntegrity.displayResolveState}</span></span>
                                <span>Verify: <span className="font-semibold text-neutral-900">{featuredIntegrity.displayVerificationState.replace(/_/g, " ")}</span></span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span>Freshness: <span className="font-semibold text-neutral-900">{featuredIntegrity.displayResolveState === "stale" ? "stale" : "fresh/unknown"}</span></span>
                                <span>
                                  Featured: <span className="font-semibold text-neutral-900">
                                    {featuredCandidate ? `${platformShortLabel(featuredCandidate.platform)} ${featuredCandidate.handle ? `@${stripAt(featuredCandidate.handle)}` : ""}`.trim() : "none"}
                                  </span>
                                </span>
                              </div>
                              {addressClass ? (
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <span>
                                    Address mode:{" "}
                                    <span className="font-semibold text-neutral-900">
                                      {addressClass.isLikelyMultiTenant ? "multi-tenant" : "single/unknown"}
                                    </span>
                                  </span>
                                  <span>
                                    Density: <span className="font-semibold text-neutral-900">{addressClass.addressDensityScore}</span>
                                  </span>
                                  {addressClass.aggregatorType ? (
                                    <span>
                                      Aggregator:{" "}
                                      <span className="font-semibold text-neutral-900">{addressClass.aggregatorType.replace(/_/g, " ")}</span>
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                              <p className="text-[10px] text-neutral-600">Reason: {featuredIntegrity.reason || featuredReason}</p>
                            </div>
                          </div>

                          <div className="rounded-lg border border-neutral-200 p-2.5 space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Trust and actions</p>
                            <div className="grid gap-1.5 sm:grid-cols-2">
                              <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                                Trust
                                <select
                                  value={getVerificationStatus(baseRow)}
                                  onChange={(e) =>
                                    applySocialProfilePatch(t.id, {
                                      verificationStatus: e.target.value as SocialVerificationStatus,
                                    })
                                  }
                                  className="mt-0.5 block w-full rounded border border-neutral-300 bg-white px-2 py-1 text-[10px]"
                                >
                                  {SOCIAL_VERIFICATION_STATUSES.map((v) => (
                                    <option key={v} value={v}>
                                      {v.replace(/_/g, " ")}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                                Visibility
                                <select
                                  value={baseRow.socialProfile?.visibilityState ?? "show"}
                                  onChange={(e) =>
                                    applySocialProfilePatch(t.id, {
                                      visibilityState: e.target.value as SocialVisibilityState,
                                    })
                                  }
                                  className="mt-0.5 block w-full rounded border border-neutral-300 bg-white px-2 py-1 text-[10px]"
                                >
                                  {SOCIAL_VISIBILITY_STATES.map((v) => (
                                    <option key={v} value={v}>
                                      {v}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            {viewMode === "review" ? (
                              <div className="grid gap-1.5 sm:grid-cols-2">
                                <select
                                  value={baseRow.profileHealth ?? "unknown"}
                                  onChange={(e) => onProfileHealthChange(t.id, e.target.value as ProfileHealth)}
                                  className="rounded border border-neutral-300 bg-white px-2 py-1 text-[10px]"
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
                                  className="rounded border border-neutral-300 bg-white px-2 py-1 text-[10px]"
                                >
                                  {ACTIVITY_EDIT.map((a) => (
                                    <option key={a} value={a}>
                                      {a}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : null}

                            {rowCandidates.length > 1 ? (
                              <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                                Featured profile
                                <select
                                  value={primarySelectValue}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setBaseTargets((prev) => {
                                      const next = prev.map((x) =>
                                        x.id === t.id ? normalizeSocialTarget(setPrimaryCandidateId(ensureSocialCandidates(x), v)) : x
                                      );
                                      void persistTargetsList(next);
                                      return next;
                                    });
                                  }}
                                  className="mt-0.5 block w-full rounded border border-neutral-300 bg-white px-2 py-1 text-[10px]"
                                >
                                  {rowCandidates.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {platformShortLabel(c.platform)} {c.handle ? `@${stripAt(c.handle)}` : (c.url ?? "—").slice(0, 32)} · {c.overallConfidenceScore}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ) : null}

                            {betterAlt ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const bestId = pickBestFeaturedCandidateId(baseRow);
                                  if (!bestId) return;
                                  setBaseTargets((prev) => {
                                    const next = prev.map((x) =>
                                      x.id === t.id ? normalizeSocialTarget(setPrimaryCandidateId(ensureSocialCandidates(x), bestId)) : x
                                    );
                                    void persistTargetsList(next);
                                    return next;
                                  });
                                }}
                                className="text-left text-[10px] font-semibold text-indigo-700 underline"
                              >
                                Promote stronger alternate
                              </button>
                            ) : null}

                            {featured?.id ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => void postPrimaryCandidatePatch(t.id, featured.id, { verificationStatus: "manual_verified" })}
                                  className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-900 hover:bg-emerald-100"
                                >
                                  Verify
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void postPrimaryCandidatePatch(t.id, featured.id, { verificationStatus: "rejected" })}
                                  className="rounded border border-neutral-400 bg-neutral-100 px-2 py-0.5 text-[9px] font-bold uppercase text-neutral-800 hover:bg-neutral-200"
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void postPrimaryCandidatePatch(t.id, featured.id, { visibilityState: "hide" })}
                                  className="rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-[9px] font-bold uppercase text-rose-900 hover:bg-rose-100"
                                >
                                  Hide
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void postPrimaryCandidatePatch(t.id, featured.id, { visibilityState: "review" })}
                                  className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-950 hover:bg-amber-100"
                                >
                                  Send to review
                                </button>
                              </div>
                            ) : null}

                            <div className="flex flex-wrap items-center gap-1.5">
                              {confirmedNoSocial ? (
                                <button
                                  type="button"
                                  onClick={() => onFindSocial(t)}
                                  className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-950 hover:bg-amber-100"
                                >
                                  FIND SOCIAL
                                </button>
                              ) : null}
                              <button
                                type="button"
                                disabled={bulkBusy === `address-expansion:${t.id}`}
                                onClick={() => void runAddressExpansionForRow(t)}
                                className="rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[9px] font-bold uppercase text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"
                              >
                                {bulkBusy === `address-expansion:${t.id}` ? "Expanding..." : "Expand address"}
                              </button>
                              <button
                                type="button"
                                disabled={verifyBusyId === t.id}
                                onClick={() => void runHeadVerify(t)}
                                className="rounded border border-sky-300 bg-sky-50 px-2 py-0.5 text-[9px] font-bold uppercase text-sky-900 hover:bg-sky-100 disabled:opacity-50"
                              >
                                {verifyBusyId === t.id ? "Verifying..." : "Verify link"}
                              </button>
                              <button
                                type="button"
                                disabled={revalidateBusyKey === `featured:${t.id}` || revalidateBusyKey === `all:${t.id}`}
                                onClick={() => void runRowRevalidate(t, "featured")}
                                className="rounded border border-violet-300 bg-violet-50 px-2 py-0.5 text-[9px] font-bold uppercase text-violet-900 hover:bg-violet-100 disabled:opacity-50"
                              >
                                {revalidateBusyKey === `featured:${t.id}` ? "Revalidating..." : "Revalidate featured"}
                              </button>
                              <button
                                type="button"
                                disabled={revalidateBusyKey === `featured:${t.id}` || revalidateBusyKey === `all:${t.id}`}
                                onClick={() => void runRowRevalidate(t, "all")}
                                className="rounded border border-violet-300 bg-white px-2 py-0.5 text-[9px] font-bold uppercase text-violet-900 hover:bg-violet-50 disabled:opacity-50"
                              >
                                {revalidateBusyKey === `all:${t.id}` ? "Revalidating..." : "Revalidate all"}
                              </button>
                            </div>

                            <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                              Status
                              <select
                                value={t.status ?? "new"}
                                onChange={(e) => setStatus(t.id, e.target.value as SocialTargetStatus)}
                                className="mt-0.5 block w-full rounded border border-neutral-300 bg-white px-2 py-1 text-[10px]"
                              >
                                {STATUS_OPTIONS.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>

                          {addressExpansion ? (
                            <details className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-2.5">
                              <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wide text-indigo-800">
                                Address expansion ({addressCandidateCount})
                              </summary>
                              <div className="mt-1.5 space-y-1.5 text-[10px] text-neutral-700">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-indigo-900">
                                    {isAddressMultiTenant ? "Likely multi-tenant" : "Single/unknown"}
                                  </span>
                                  {addressClass?.aggregatorType ? (
                                    <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-900">
                                      {addressClass.aggregatorType.replace(/_/g, " ")}
                                    </span>
                                  ) : null}
                                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-neutral-700">
                                    Density {addressClass?.addressDensityScore ?? 0}
                                  </span>
                                  <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-sky-900">
                                    Priority {addressClass?.expansionPriority ?? "low"}
                                  </span>
                                </div>
                                <p className="text-[9px] text-neutral-600">
                                  Evidence families: booking {(baseRow.evidence ?? []).filter((ev) => ev.type === "booking_platform").length}
                                  {" · "}
                                  social {(baseRow.evidence ?? []).filter((ev) => ev.platform === "instagram" || ev.platform === "tiktok" || ev.platform === "linktree").length}
                                  {" · "}
                                  directory {(baseRow.evidence ?? []).filter((ev) => ev.type === "directory_expansion" || ev.type === "directory").length}
                                  {" · "}
                                  aggregator {(baseRow.evidence ?? []).filter((ev) => ev.type === "aggregator_site" || ev.type === "suite_operator").length}
                                </p>
                                {(addressExpansion.candidates ?? []).slice(0, 6).map((candidate) => (
                                  <div key={candidate.id} className="rounded border border-indigo-100 bg-white p-1.5">
                                    <div className="flex flex-wrap items-center gap-1">
                                      <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">
                                        {candidate.confidence}
                                      </span>
                                      {candidate.prospect ? (
                                        <span
                                          className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${
                                            candidate.prospect.tier === "hot"
                                              ? "bg-rose-100 text-rose-900"
                                              : candidate.prospect.tier === "warm"
                                                ? "bg-amber-100 text-amber-900"
                                                : candidate.prospect.tier === "cold"
                                                  ? "bg-neutral-200 text-neutral-700"
                                                  : "bg-neutral-100 text-neutral-500"
                                          }`}
                                        >
                                          {candidate.prospect.tier} {candidate.prospect.readinessScore}
                                        </span>
                                      ) : null}
                                      {candidate.platform ? (
                                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[8px] font-bold uppercase text-indigo-900">
                                          {platformShortLabel(candidate.platform)}
                                        </span>
                                      ) : null}
                                      {candidate.bookingUrl ? (
                                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold uppercase text-emerald-900">
                                          booking
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="mt-0.5 break-all text-[10px] font-medium text-neutral-900">{candidate.operatorName}</p>
                                    <p className="truncate text-[9px] text-neutral-600">{candidate.url ?? candidate.bookingUrl ?? "No URL captured"}</p>
                                  </div>
                                ))}
                              </div>
                            </details>
                          ) : null}

                          {sourceIntake.length > 0 ? (
                            <details className="rounded-lg border border-neutral-200 p-2.5">
                              <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wide text-neutral-600">
                                Source intake ({sourceIntake.length})
                              </summary>
                              <div className="mt-1.5 space-y-1.5">
                                {sourceIntake.map((item, idx) => {
                                  const sourceLabel = sourceTypeBadgeLabel(item.input.sourceType);
                                  const trustLabel = sourceTrustTierLabel(item.input.sourceTrustTier);
                                  const statusLabel =
                                    item.status === "already_present"
                                      ? "Already present"
                                      : item.status === "duplicate"
                                        ? "Duplicate"
                                        : item.status === "rejected_previously"
                                          ? "Rejected previously"
                                          : item.status === "hidden_previously"
                                            ? "Hidden previously"
                                            : "New candidate";
                                  const statusCls =
                                    item.status === "new_candidate"
                                      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                                      : item.status === "already_present" || item.status === "duplicate"
                                        ? "bg-sky-50 text-sky-900 border-sky-200"
                                        : "bg-neutral-100 text-neutral-700 border-neutral-300";
                                  const busyKey = `${t.id}:${item.input.sourceType}:${item.input.rawSourceId ?? item.input.profileUrl ?? item.input.handle ?? "source"}`;
                                  const isBusy = sourceIntakeBusyKey === busyKey;
                                  const title =
                                    item.input.profileUrl ||
                                    item.input.handle ||
                                    item.input.businessName ||
                                    item.input.sourceUrl ||
                                    "Candidate";
                                  return (
                                    <div key={`${busyKey}:${idx}`} className="rounded-md border border-neutral-200 bg-neutral-50 p-1.5">
                                      <div className="flex flex-wrap items-center gap-1">
                                        <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">{sourceLabel}</span>
                                        <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[8px] font-bold uppercase text-neutral-700">{trustLabel}</span>
                                        {item.previewCandidate.platform ? (
                                          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[8px] font-bold uppercase text-indigo-900">
                                            {platformShortLabel(item.previewCandidate.platform)}
                                          </span>
                                        ) : null}
                                        <span className={`rounded border px-1.5 py-0.5 text-[8px] font-semibold ${statusCls}`}>{statusLabel}</span>
                                      </div>
                                      <p className="mt-0.5 text-[10px] font-medium text-neutral-900 break-all">{title}</p>
                                      {item.input.evidence?.length ? <p className="text-[9px] text-neutral-600">{item.input.evidence[0]}</p> : null}
                                      <div className="mt-1 flex flex-wrap items-center gap-1">
                                        <button
                                          type="button"
                                          disabled={isBusy}
                                          onClick={() => void applySourceIntakeAction(t.id, item.input, "accept")}
                                          className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold uppercase text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                                        >
                                          Accept
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isBusy}
                                          onClick={() => void applySourceIntakeAction(t.id, item.input, "verify")}
                                          className="rounded border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[8px] font-bold uppercase text-sky-900 hover:bg-sky-100 disabled:opacity-50"
                                        >
                                          Verify
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isBusy}
                                          onClick={() => void applySourceIntakeAction(t.id, item.input, "reject")}
                                          className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[8px] font-bold uppercase text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                                        >
                                          Reject
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isBusy}
                                          onClick={() => void applySourceIntakeAction(t.id, item.input, "hide")}
                                          className="rounded border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[8px] font-bold uppercase text-rose-900 hover:bg-rose-100 disabled:opacity-50"
                                        >
                                          Hide
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </details>
                          ) : null}
                        </div>

                        <div className="min-w-0 space-y-2 lg:max-w-[22rem]">
                          <div className="rounded-lg border border-neutral-200 p-2.5 space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Operator inputs</p>
                            {viewMode === "review" ? (
                              <>
                                <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                                  Priority (0-100)
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
                                          x.id === t.id ? { ...x, priorityScore: clamped, priorityScoreManual: true } : x
                                        );
                                        void persistTargetsList(next);
                                        return next;
                                      });
                                    }}
                                    className="mt-0.5 w-full rounded border border-neutral-300 bg-white px-2 py-0.5 text-[10px] tabular-nums"
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
                                  className="text-left text-[10px] font-semibold text-indigo-700 underline"
                                >
                                  Use auto score
                                </button>
                              </>
                            ) : null}
                            <textarea
                              key={`${t.id}-vnote-${baseRow.verificationNote ?? ""}`}
                              defaultValue={baseRow.verificationNote ?? ""}
                              rows={1}
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
                              className="w-full rounded border border-neutral-300 bg-white px-2 py-0.5 text-[10px]"
                            />
                            <textarea
                              key={`${t.id}-angle-${baseRow.outreachAngle ?? ""}`}
                              defaultValue={baseRow.outreachAngle ?? ""}
                              rows={1}
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
                              className="w-full rounded border border-neutral-300 bg-white px-2 py-0.5 text-[10px]"
                            />
                            <textarea
                              key={`${t.id}-notes-${baseRow.notes ?? ""}`}
                              defaultValue={baseRow.notes ?? ""}
                              rows={1}
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
                              className="w-full rounded border border-neutral-300 bg-white px-2 py-0.5 text-[10px]"
                            />
                          </div>

                          <div className="rounded-lg border border-neutral-200 p-2.5 space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Referral actions</p>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-neutral-700">
                              <span>
                                Out: <span className="font-semibold tabular-nums text-neutral-900">{outgoing}</span>
                              </span>
                              <span>
                                In: <span className="font-semibold tabular-nums text-neutral-900">{incoming}</span>
                              </span>
                              {t.isReferralHub ? (
                                <span className="inline-block rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-900">
                                  HUB
                                </span>
                              ) : null}
                            </div>
                            <input
                              value={draft.toHandle}
                              onChange={(e) => setDraftField(t.id, { toHandle: e.target.value })}
                              placeholder="Referred @handle"
                              className="w-full rounded border border-neutral-300 bg-white px-2 py-0.5 text-[10px]"
                            />
                            <div className="flex flex-wrap gap-1.5">
                              <select
                                value={draft.referredCategory}
                                onChange={(e) => setDraftField(t.id, { referredCategory: e.target.value as ReferralCategory })}
                                className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[10px]"
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
                                className="min-w-[5rem] flex-1 rounded border border-neutral-300 bg-white px-2 py-0.5 text-[10px]"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => addReferral(t)}
                              className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white hover:bg-indigo-700"
                            >
                              Add referral
                            </button>
                          </div>
                        </div>
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
