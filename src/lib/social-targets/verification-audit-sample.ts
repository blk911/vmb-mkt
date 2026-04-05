import { compareTargetsByOperatorRank } from "@/lib/social-targets/operator-rank";
import { writeJsonFilePretty } from "@/lib/social-targets/json-file";
import { normalizeSocialTarget } from "@/lib/social-targets/normalization";
import { getMergedSocialTargets, saveMergedSocialTargetsAsRuntime } from "@/lib/social-targets/social-targets-store";
import { ensureSocialCandidates, getPrimaryCandidate, patchCandidate } from "@/lib/social-targets/social-candidate-logic";
import { verifySocialCandidate } from "@/lib/social-targets/social-verification";
import { evaluateCandidateVerificationLadder } from "@/lib/social-targets/verification-ladder";
import { getVerificationState } from "@/lib/social-targets/verification-state";
import type { CandidateType, SocialPlatform, SocialTarget, VerificationState } from "@/types/social-target";

const REPORT_FILE = "runtime-data/reports/verification-audit-sample.json";

type AuditResult = "live_correct" | "dead" | "wrong_business" | "ambiguous" | "no_primary_url";

type AuditedRowReport = {
  id: string;
  handle: string;
  name: string;
  candidateType: CandidateType | "n/a";
  primaryUrlChecked?: string;
  confidenceScore: number;
  priorVerificationState: VerificationState;
  auditResult: AuditResult;
  resultingVerificationState: VerificationState;
  note: string;
};

type VerificationAuditSummary = {
  live_correct: number;
  dead: number;
  wrong_business: number;
  ambiguous: number;
  no_primary_url: number;
};

type VerificationAuditOutput = {
  sampledIds: string[];
  before: {
    total: number;
    liveVerified: number;
    topReadyCount: number;
  };
  after: {
    total: number;
    liveVerified: number;
    topReadyCount: number;
  };
  summary: VerificationAuditSummary;
  auditedRows: AuditedRowReport[];
};

function stripAt(v?: string): string {
  return (v ?? "").replace(/^@/, "").trim();
}

function rowVisibilityBucket(t: SocialTarget): "show" | "review" | "hide" {
  const p = getPrimaryCandidate(ensureSocialCandidates(t));
  if (p?.visibilityState === "hide" || t.socialProfile?.visibilityState === "hide") return "hide";
  if (p?.visibilityState === "review" || t.socialProfile?.visibilityState === "review") return "review";
  return "show";
}

function shouldShowInPrimaryByTruth(t: SocialTarget): boolean {
  const visibility = rowVisibilityBucket(t);
  if (visibility !== "show") return false;
  const state = getVerificationState(t);
  return state !== "dead" && state !== "rejected";
}

function topReadyCount(targets: SocialTarget[]): number {
  return targets.filter((t) => getVerificationState(t) === "live_verified" && shouldShowInPrimaryByTruth(t)).length;
}

function bestCandidateType(t: SocialTarget): CandidateType | "n/a" {
  const types = (t.addressExpansion?.candidates ?? [])
    .map((candidate) => candidate.prospect?.type)
    .filter((x): x is CandidateType => Boolean(x));
  if (!types.length) return "n/a";
  const score = new Map<CandidateType, number>([
    ["operator", 5],
    ["booking_operator", 4],
    ["ambiguous", 3],
    ["directory", 2],
    ["aggregator", 1],
  ]);
  return [...types].sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0))[0] ?? "n/a";
}

function selectAuditSample(input: SocialTarget[]): SocialTarget[] {
  const all = [...input].sort((a, b) => compareTargetsByOperatorRank(a, b, true));
  const livePool = all.filter((t) => getVerificationState(t) === "live_verified");
  const candidatePool = all.filter((t) => {
    const state = getVerificationState(t);
    return state === "unverified" || state === "matched";
  });
  const reviewPool = all.filter((t) => {
    const state = getVerificationState(t);
    return state === "dead" || state === "rejected";
  });

  const out: SocialTarget[] = [];
  const seen = new Set<string>();
  const take = (pool: SocialTarget[], limit: number) => {
    for (const t of pool) {
      if (out.length >= 10) return;
      if (seen.has(t.id)) continue;
      if (limit <= 0) return;
      out.push(t);
      seen.add(t.id);
      limit -= 1;
    }
  };

  take(livePool, 5);
  take(candidatePool, 3);
  take(reviewPool, 2);
  if (out.length < 10) {
    take(all, 10 - out.length);
  }
  return out.slice(0, 10);
}

function noteForResult(result: AuditResult, resolveStatus?: string): string {
  if (result === "live_correct") return "Featured profile resolves and matches anchor expectations.";
  if (result === "dead") return "Featured profile no longer resolves.";
  if (result === "wrong_business") return "Profile resolves but appears to mismatch anchor identity.";
  if (result === "ambiguous") return `Profile check inconclusive (${resolveStatus ?? "unknown"}).`;
  return "No primary URL/handle available for deterministic profile verification.";
}

async function fetchProfileContent(url: string): Promise<{ ok: boolean; status: number; finalUrl: string; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "VMB-SocialTargetsAudit/1.0",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        Range: "bytes=0-65535",
      },
    });
    const text = (await res.text()).slice(0, 65_535).toLowerCase();
    return { ok: res.ok, status: res.status, finalUrl: res.url, text };
  } catch {
    return { ok: false, status: 0, finalUrl: url, text: "" };
  } finally {
    clearTimeout(timer);
  }
}

async function classifyContentAudit(input: {
  platform: SocialPlatform;
  url?: string;
  handle?: string;
}): Promise<{ result?: AuditResult; note?: string }> {
  const url = input.url?.trim();
  if (!url) return {};
  const cleanHandle = stripAt(input.handle).toLowerCase();
  const content = await fetchProfileContent(url);
  if (content.status === 404 || content.status === 410) {
    return { result: "dead", note: "HTTP 404/410 confirms missing profile." };
  }
  if (!content.ok || !content.text) {
    return { result: "ambiguous", note: "Could not reliably fetch profile body for identity confirmation." };
  }

  const deadMarkers = [
    "page isn't available",
    "link you followed may be broken",
    "this account doesn't exist",
    "couldn't find this account",
    "this linktree does not exist",
    "profile not found",
  ];
  if (deadMarkers.some((marker) => content.text.includes(marker))) {
    return { result: "dead", note: "Profile body contains known missing/dead markers." };
  }

  const finalPath = (() => {
    try {
      return new URL(content.finalUrl).pathname.toLowerCase();
    } catch {
      return "";
    }
  })();
  const finalSegments = finalPath.split("/").filter(Boolean).map((segment) => segment.replace(/^@/, ""));
  const finalHandle = finalSegments[0]?.toLowerCase();

  if (cleanHandle) {
    if (finalHandle && finalHandle !== cleanHandle && finalHandle !== "accounts" && finalHandle !== "login") {
      return { result: "wrong_business", note: `Redirected to different handle (${finalHandle}).` };
    }
    if (finalPath.includes(cleanHandle) || content.text.includes(cleanHandle)) {
      return { result: "live_correct", note: "Handle found in final path/body." };
    }
    return { result: "ambiguous", note: "Profile loaded but handle could not be confirmed in body/path." };
  }

  return { result: "ambiguous", note: "No handle present; profile correctness is ambiguous." };
}

export async function runVerificationAuditSample(): Promise<VerificationAuditOutput> {
  const merged = (await getMergedSocialTargets()).map((t) => normalizeSocialTarget(t));
  const sample = selectAuditSample(merged);
  const sampleIds = new Set(sample.map((t) => t.id));
  const nowIso = new Date().toISOString();

  const before = {
    total: merged.length,
    liveVerified: merged.filter((t) => getVerificationState(t) === "live_verified").length,
    topReadyCount: topReadyCount(merged),
  };

  const summary: VerificationAuditSummary = {
    live_correct: 0,
    dead: 0,
    wrong_business: 0,
    ambiguous: 0,
    no_primary_url: 0,
  };
  const reportRows: AuditedRowReport[] = [];
  const next = [...merged];

  for (let i = 0; i < next.length; i += 1) {
    const row = next[i];
    if (!sampleIds.has(row.id)) continue;

    let target = ensureSocialCandidates(normalizeSocialTarget(row));
    const featured = getPrimaryCandidate(target);
    const priorState = getVerificationState(target);
    const featuredUrl = featured?.url?.trim();
    const featuredHandle = stripAt(featured?.handle);

    let auditResult: AuditResult = "no_primary_url";
    let note = "No primary profile candidate available.";
    let checkedUrl: string | undefined = featuredUrl;
    let resolveStatus = "unknown";

    if (featured && (featuredUrl || featuredHandle)) {
      const verification = await verifySocialCandidate(featured);
      resolveStatus = verification.resolveStatus;
      checkedUrl = verification.checkedUrl ?? featuredUrl;
      const contentAudit = await classifyContentAudit({
        platform: featured.platform,
        url: checkedUrl,
        handle: featured.handle,
      });
      const ladder = evaluateCandidateVerificationLadder(target, featured, {
        verification,
        alternatives: (target.socialCandidates ?? []).filter((candidate) => candidate.id !== featured.id),
      });

      if (contentAudit.result === "dead" || verification.resolveStatus === "dead") {
        auditResult = "dead";
      } else if (contentAudit.result === "wrong_business") {
        auditResult = "wrong_business";
      } else if (ladder.identityMatchState === "mismatch" || ladder.territoryState === "out_of_territory") {
        auditResult = "wrong_business";
      } else if (contentAudit.result === "ambiguous") {
        auditResult = "ambiguous";
      } else if (contentAudit.result === "live_correct") {
        auditResult = "live_correct";
      } else if (
        verification.resolveStatus === "live" &&
        (ladder.identityMatchState === "strong" || ladder.identityMatchState === "plausible")
      ) {
        auditResult = "live_correct";
      } else {
        auditResult = "ambiguous";
      }

      const patch: Parameters<typeof patchCandidate>[2] = {
        lastCheckedAt: verification.lastCheckedAt,
      };
      if (auditResult === "live_correct") {
        patch.resolveStatus = "live";
        patch.activityStatus = verification.activityStatus === "recent" ? "recent" : "unknown";
        patch.verificationStatus = "auto_verified";
        patch.lastVerifiedAt = verification.lastCheckedAt;
      } else if (auditResult === "dead") {
        patch.resolveStatus = "dead";
        patch.activityStatus = "stale";
        patch.verificationStatus = "candidate";
        patch.visibilityState = "review";
      } else if (auditResult === "wrong_business") {
        patch.resolveStatus = verification.resolveStatus === "live" ? "live" : "unknown";
        patch.verificationStatus = "rejected";
        patch.visibilityState = "review";
      } else if (auditResult === "ambiguous") {
        patch.resolveStatus =
          verification.resolveStatus === "blocked" || verification.resolveStatus === "redirect"
            ? verification.resolveStatus
            : "unknown";
        patch.verificationStatus = "candidate";
        patch.lastCheckedAt = null;
        patch.lastVerifiedAt = null;
      }
      let patchedTarget = patchCandidate(target, featured.id, patch);
      patchedTarget = {
        ...patchedTarget,
        socialProfile: {
          ...(patchedTarget.socialProfile ?? {}),
          ...(patch.resolveStatus ? { resolveStatus: patch.resolveStatus } : {}),
          ...(patch.activityStatus ? { activityStatus: patch.activityStatus } : {}),
          ...(patch.verificationStatus ? { verificationStatus: patch.verificationStatus } : {}),
          ...(patch.visibilityState ? { visibilityState: patch.visibilityState } : {}),
          ...(patch.lastCheckedAt !== undefined ? { lastCheckedAt: patch.lastCheckedAt } : {}),
          ...(patch.lastVerifiedAt !== undefined ? { lastVerifiedAt: patch.lastVerifiedAt } : {}),
        },
      };
      target = normalizeSocialTarget(patchedTarget);
      note = [noteForResult(auditResult, resolveStatus), contentAudit.note].filter(Boolean).join(" ");
    } else {
      note = noteForResult("no_primary_url");
    }

    summary[auditResult] += 1;
    target = {
      ...target,
      lastVerifiedAt: nowIso,
      verificationNote: `verification audit sample (${auditResult}) - ${note}`,
    };
    const actualState = getVerificationState(target);

    next[i] = target;
    reportRows.push({
      id: target.id,
      handle: `@${stripAt(target.handle)}`,
      name: target.businessName ?? stripAt(target.handle),
      candidateType: bestCandidateType(target),
      primaryUrlChecked: checkedUrl,
      confidenceScore: target.confidenceScore ?? 0,
      priorVerificationState: priorState,
      auditResult,
      resultingVerificationState: actualState,
      note,
    });
  }

  await saveMergedSocialTargetsAsRuntime(next);

  const after = {
    total: next.length,
    liveVerified: next.filter((t) => getVerificationState(t) === "live_verified").length,
    topReadyCount: topReadyCount(next),
  };

  const output: VerificationAuditOutput = {
    sampledIds: sample.map((t) => t.id),
    before,
    after,
    summary,
    auditedRows: reportRows,
  };
  await writeJsonFilePretty(REPORT_FILE, output);
  return output;
}
