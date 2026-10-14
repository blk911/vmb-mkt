import "server-only";
import { listStagedOperatorEvidence } from "@/lib/source-intake/store";
import { listDoraResults, listSocialResults } from "@/lib/source-intake/phase2-store";
import type { CatalogSources } from "@/lib/catalog/projection";

/** One source snapshot per pass; joins and attribution use the catalog's pure adapter. */
export async function loadProfileEvidenceSources(): Promise<Map<string, CatalogSources>> {
  const [dora, social, staged] = await Promise.all([listDoraResults(), listSocialResults(), listStagedOperatorEvidence()]);
  const docs = (rows: Array<{ id: string }>) => rows.map((row) => ({ id: row.id, data: row as unknown as Record<string, unknown> }));
  const indexed = new Map<string, CatalogSources>();
  for (const [collection, rows] of Object.entries({ adminPipelineDoraResults: docs(dora), adminPipelineSocialResults: docs(social), adminPipelineOperatorEvidence: docs(staged) })) {
    for (const row of rows) {
      if (typeof row.data.intakeId !== "string" || typeof row.data.candidateId !== "string") continue;
      const key = JSON.stringify([row.data.intakeId, row.data.candidateId]);
      const sources = indexed.get(key) || {};
      (sources[collection] ||= []).push(row);
      indexed.set(key, sources);
    }
  }
  return indexed;
}
