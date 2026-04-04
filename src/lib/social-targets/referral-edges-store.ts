import seedEdges from "@/data/socialTargets/referral_edges_v1.json";
import type { ReferralEdge } from "@/types/social-target";
import { readJsonArrayFile, writeJsonFilePretty } from "@/lib/social-targets/json-file";
import { RUNTIME_REFERRAL_EDGES_FILE } from "@/lib/social-targets/runtime-paths";

function edgesEqual(a: ReferralEdge, b: ReferralEdge): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function getSeedReferralEdges(): Promise<ReferralEdge[]> {
  return Promise.resolve(seedEdges as ReferralEdge[]);
}

export async function getRuntimeReferralEdges(): Promise<ReferralEdge[]> {
  return readJsonArrayFile<ReferralEdge>(RUNTIME_REFERRAL_EDGES_FILE, []);
}

export async function getMergedReferralEdges(): Promise<ReferralEdge[]> {
  const seed = await getSeedReferralEdges();
  const runtime = await getRuntimeReferralEdges();
  const runtimeById = new Map(runtime.map((e) => [e.id, e]));
  const merged: ReferralEdge[] = [];
  const seen = new Set<string>();
  for (const e of seed) {
    merged.push(runtimeById.get(e.id) ?? e);
    seen.add(e.id);
  }
  for (const e of runtime) {
    if (!seen.has(e.id)) merged.push(e);
  }
  return merged;
}

export function buildRuntimeReferralEdgesOverlay(merged: ReferralEdge[], seed: ReferralEdge[]): ReferralEdge[] {
  const seedMap = new Map(seed.map((e) => [e.id, e]));
  const out: ReferralEdge[] = [];
  for (const e of merged) {
    const s = seedMap.get(e.id);
    if (!s) out.push(e);
    else if (!edgesEqual(e, s)) out.push(e);
  }
  return out;
}

export async function saveRuntimeReferralEdges(edges: ReferralEdge[]): Promise<void> {
  await writeJsonFilePretty(RUNTIME_REFERRAL_EDGES_FILE, edges);
}

export async function saveMergedReferralEdgesAsRuntime(merged: ReferralEdge[]): Promise<number> {
  const seed = await getSeedReferralEdges();
  const overlay = buildRuntimeReferralEdgesOverlay(merged, seed);
  await saveRuntimeReferralEdges(overlay);
  return overlay.length;
}

export async function upsertRuntimeReferralEdge(edge: ReferralEdge): Promise<void> {
  const runtime = await getRuntimeReferralEdges();
  const idx = runtime.findIndex((e) => e.id === edge.id);
  const next = idx === -1 ? [...runtime, edge] : runtime.map((e, i) => (i === idx ? edge : e));
  await saveRuntimeReferralEdges(next);
}
