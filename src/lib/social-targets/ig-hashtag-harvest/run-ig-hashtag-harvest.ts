import fs from "node:fs/promises";
import path from "node:path";
import { appendEvidence, loadEvidence } from "../../evidence/store";
import type { EvidenceRecord } from "../../evidence/types";
import { getRuntimeDataRoot } from "../../runtime/runtime-data-root";
import { loadResolverRegistry } from "../../resolver/registry-store";
import { runResolver } from "../../resolver/run-resolver";
import { mapIGPostToEvidence } from "./adapter";
import { harvestInstagramHashtag } from "./harvest";
import type { IGHashtagHarvestResult } from "./types";

function normalizeHashtag(input: string): string {
  return input.trim().replace(/^#/, "").toLowerCase();
}

function evidenceKey(e: {
  source: string;
  evidenceType?: string;
  sourceUrl?: string;
  sourceId?: string;
  handle?: string;
}): string {
  return [
    e.source,
    e.evidenceType ?? "",
    e.sourceUrl ?? "",
    e.sourceId ?? "",
    e.handle ?? "",
  ].join("::");
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function runIGHashtagHarvest(
  rawHashtag: string,
  limit = 50
): Promise<IGHashtagHarvestResult> {
  const hashtag = normalizeHashtag(rawHashtag);
  const requestedLimit = Math.max(1, Math.min(200, limit));

  const posts = await harvestInstagramHashtag(hashtag, requestedLimit);
  const mappedEvidence = posts.map(mapIGPostToEvidence);

  const existingEvidence = loadEvidence();
  const existingKeys = new Set(
    (existingEvidence ?? []).map((e: EvidenceRecord) =>
      evidenceKey({
        source: e.source,
        evidenceType: e.evidenceType,
        sourceUrl: e.sourceUrl,
        sourceId: e.sourceId,
        handle: e.handle,
      })
    )
  );

  const dedupedBatch: EvidenceRecord[] = [];
  const batchKeys = new Set<string>();

  for (const e of mappedEvidence) {
    const key = evidenceKey(e);
    if (existingKeys.has(key)) continue;
    if (batchKeys.has(key)) continue;
    batchKeys.add(key);
    dedupedBatch.push(e);
  }

  if (dedupedBatch.length > 0) {
    appendEvidence(dedupedBatch);
  }

  const resolverBefore = loadResolverRegistry().length;
  const resolvedOperators = runResolver();
  const resolverAfter = resolvedOperators.length;
  const operatorsCreated = Math.max(0, resolverAfter - resolverBefore);
  // We do not have a first-class merge counter from resolver yet, so approximate
  // "merged" as evidence that attached without growing the operator registry.
  const operatorsMerged = Math.max(0, dedupedBatch.length - operatorsCreated);

  const summaryDir = getRuntimeDataRoot();
  await ensureDir(summaryDir);

  const relativeSummaryPath = `runtime-data/ig-hashtag-harvest-${hashtag}.summary.json`;
  const summaryAbsPath = path.join(summaryDir, `ig-hashtag-harvest-${hashtag}.summary.json`);

  const summary = {
    hashtag,
    requestedLimit,
    postsPulled: posts.length,
    evidenceAdded: dedupedBatch.length,
    operatorsCreated,
    operatorsMerged,
    sample: posts[0] ?? null,
    generatedAt: new Date().toISOString(),
  };

  await fs.writeFile(summaryAbsPath, JSON.stringify(summary, null, 2), "utf8");

  return {
    hashtag,
    requestedLimit,
    postsPulled: posts.length,
    evidenceAdded: dedupedBatch.length,
    operatorsCreated,
    operatorsMerged,
    summaryPath: relativeSummaryPath,
    sample: posts[0],
    posts,
  };
}
