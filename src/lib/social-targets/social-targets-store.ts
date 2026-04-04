import seedTargets from "@/data/socialTargets/social_targets_v1.json";
import type { SocialTarget } from "@/types/social-target";
import { readJsonArrayFile, writeJsonFilePretty } from "@/lib/social-targets/json-file";
import { RUNTIME_SOCIAL_TARGETS_FILE } from "@/lib/social-targets/runtime-paths";

function stripComputedTarget(t: SocialTarget): SocialTarget {
  const { referralCount, referredByCount, isReferralHub, ...rest } = t;
  return rest;
}

function targetsEqual(a: SocialTarget, b: SocialTarget): boolean {
  return JSON.stringify(stripComputedTarget(a)) === JSON.stringify(stripComputedTarget(b));
}

export function getSeedSocialTargets(): Promise<SocialTarget[]> {
  return Promise.resolve(seedTargets as SocialTarget[]);
}

export async function getRuntimeSocialTargets(): Promise<SocialTarget[]> {
  return readJsonArrayFile<SocialTarget>(RUNTIME_SOCIAL_TARGETS_FILE, []);
}

export async function getMergedSocialTargets(): Promise<SocialTarget[]> {
  const seed = await getSeedSocialTargets();
  const runtime = await getRuntimeSocialTargets();
  const runtimeById = new Map(runtime.map((t) => [t.id, t]));
  const merged: SocialTarget[] = [];
  const seen = new Set<string>();
  for (const t of seed) {
    merged.push(runtimeById.get(t.id) ?? t);
    seen.add(t.id);
  }
  for (const t of runtime) {
    if (!seen.has(t.id)) merged.push(t);
  }
  return merged;
}

/** Build runtime overlay rows: new ids or any field change vs seed. */
export function buildRuntimeTargetsOverlay(merged: SocialTarget[], seed: SocialTarget[]): SocialTarget[] {
  const seedMap = new Map(seed.map((t) => [t.id, stripComputedTarget(t)]));
  const out: SocialTarget[] = [];
  for (const t of merged) {
    const clean = stripComputedTarget(t);
    const s = seedMap.get(clean.id);
    if (!s) out.push(clean);
    else if (!targetsEqual(clean, s)) out.push(clean);
  }
  return out;
}

export async function saveRuntimeSocialTargets(targets: SocialTarget[]): Promise<void> {
  const normalized = targets.map((t) => stripComputedTarget(t));
  await writeJsonFilePretty(RUNTIME_SOCIAL_TARGETS_FILE, normalized);
}

/** Save merged operator view: persists only rows that differ from seed (or are new). */
export async function saveMergedSocialTargetsAsRuntime(merged: SocialTarget[]): Promise<number> {
  const seed = await getSeedSocialTargets();
  const overlay = buildRuntimeTargetsOverlay(merged, seed);
  await saveRuntimeSocialTargets(overlay);
  return overlay.length;
}

export async function upsertRuntimeSocialTarget(target: SocialTarget): Promise<void> {
  const clean = stripComputedTarget(target);
  const runtime = await getRuntimeSocialTargets();
  const idx = runtime.findIndex((t) => t.id === clean.id);
  const next = idx === -1 ? [...runtime, clean] : runtime.map((t, i) => (i === idx ? clean : t));
  await saveRuntimeSocialTargets(next);
}
