import { runGoogleDiscoveryForTarget } from "@/lib/social-targets/normalization";
import type { DiscoveryAnchor } from "@/lib/social-targets/google-discovery/query-generator";
import type { GoogleQueryResultSet } from "@/lib/social-targets/google-discovery/run-discovery";
import { computeSocialTargetMetrics, compareSocialTargetMetrics, type SocialTargetMetricsCompare } from "@/lib/social-targets/metrics";
import { writeJsonFilePretty } from "@/lib/social-targets/json-file";
import {
  RUNTIME_BASELINE_METRICS_FILE,
  RUNTIME_CURRENT_METRICS_FILE,
  RUNTIME_SOCIAL_TARGETS_BASELINE_FILE,
  RUNTIME_VALIDATION_COMPARE_FILE,
} from "@/lib/social-targets/runtime-paths";
import { getMergedSocialTargets, saveMergedSocialTargetsAsRuntime } from "@/lib/social-targets/social-targets-store";
import { normalizeSocialTarget } from "@/lib/social-targets/normalization";
import type { SocialTarget } from "@/types/social-target";

export type ValidationPullInput = {
  targetIds?: string[];
  sourceVersion?: string;
  runType?: "validation" | "scale" | "adhoc";
  googleResultsByTarget?: Record<string, GoogleQueryResultSet[]>;
};

export type ValidationPullOutput = {
  runId: string;
  runType: "validation" | "scale" | "adhoc";
  sourceVersion: string;
  processedTargets: number;
  baselineCount: number;
  compare: SocialTargetMetricsCompare;
  queryCountByTarget: Record<string, number>;
  updatedTargetIds: string[];
};

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function buildAnchorFromTarget(target: SocialTarget): DiscoveryAnchor {
  const aliases = [target.businessName, target.handle.replace(/^@/, "")]
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .filter((v, i, arr) => arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i)
    .slice(1);
  return {
    name: target.businessName || target.handle.replace(/^@/, ""),
    nameVariants: aliases.length ? aliases : undefined,
    category: target.category,
    city: target.zone,
    zone: target.zone,
    website: target.platforms?.instagram || target.platforms?.tiktok || target.platforms?.linktree,
  };
}

function buildRunId(targets: SocialTarget[], sourceVersion: string): string {
  const zone = targets[0]?.zone ?? "geo";
  const date = new Date().toISOString().slice(0, 10);
  return `${slug(zone)}-${date}-${slug(sourceVersion)}-${shortId()}`;
}

export async function runValidationPull(input: ValidationPullInput): Promise<ValidationPullOutput> {
  const runType = input.runType ?? "validation";
  const sourceVersion = input.sourceVersion ?? "google-discovery-v2";
  const allTargets = (await getMergedSocialTargets()).map(normalizeSocialTarget);
  const baselineTargets = allTargets.map((t) => ({ ...t }));
  const baselineMetrics = computeSocialTargetMetrics(baselineTargets);

  const wanted =
    input.targetIds && input.targetIds.length
      ? new Set(input.targetIds.filter(Boolean))
      : new Set(allTargets.map((t) => t.id));
  const selected = allTargets.filter((t) => wanted.has(t.id));
  const runId = buildRunId(selected.length ? selected : allTargets, sourceVersion);
  const queryCountByTarget: Record<string, number> = {};
  const updatedTargetIds: string[] = [];

  const nextTargets = allTargets.map((target) => {
    if (!wanted.has(target.id)) return target;
    const queryResults = input.googleResultsByTarget?.[target.id] ?? [];
    const anchor = buildAnchorFromTarget(target);
    const result = runGoogleDiscoveryForTarget(target, anchor, queryResults, {
      runId,
      runType,
      sourceVersion,
    });
    queryCountByTarget[target.id] = result.queries.length;
    if (queryResults.length > 0 || result.inputs.length > 0) updatedTargetIds.push(target.id);
    return result.target;
  });

  await writeJsonFilePretty(RUNTIME_SOCIAL_TARGETS_BASELINE_FILE, baselineTargets);
  await writeJsonFilePretty(RUNTIME_BASELINE_METRICS_FILE, baselineMetrics);

  const currentMetrics = computeSocialTargetMetrics(nextTargets);
  await writeJsonFilePretty(RUNTIME_CURRENT_METRICS_FILE, currentMetrics);
  const compare = compareSocialTargetMetrics(baselineMetrics, currentMetrics);
  await writeJsonFilePretty(RUNTIME_VALIDATION_COMPARE_FILE, {
    runId,
    runType,
    sourceVersion,
    generatedAt: new Date().toISOString(),
    ...compare,
  });
  await saveMergedSocialTargetsAsRuntime(nextTargets);

  return {
    runId,
    runType,
    sourceVersion,
    processedTargets: selected.length,
    baselineCount: baselineTargets.length,
    compare,
    queryCountByTarget,
    updatedTargetIds,
  };
}
