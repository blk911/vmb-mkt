import crypto from "node:crypto";
import type { EvidenceRecord } from "@/lib/evidence/types";

function childId(parentId: string, seed: string, index: number): string {
  return crypto.createHash("md5").update(`${parentId}|${seed}|${index}`).digest("hex");
}

function parseTenantHintsFromRaw(parent: EvidenceRecord): Array<{ name?: string; url?: string }> {
  const out: Array<{ name?: string; url?: string }> = [];
  const extracted = parent.extracted as Record<string, unknown> | undefined;
  const raw = parent.raw as Record<string, unknown> | undefined;
  const tenantCandidates = [extracted?.tenants, raw?.tenants];
  for (const candidate of tenantCandidates) {
    if (!Array.isArray(candidate)) continue;
    for (const row of candidate) {
      if (!row || typeof row !== "object") continue;
      const x = row as Record<string, unknown>;
      const name = typeof x.name === "string" ? x.name : undefined;
      const url = typeof x.url === "string" ? x.url : undefined;
      if (name || url) out.push({ name, url });
    }
  }
  return out;
}

export function expandContainerEvidence(evidence: EvidenceRecord[]): EvidenceRecord[] {
  const expanded: EvidenceRecord[] = [...evidence];
  for (const row of evidence) {
    if (row.evidenceType !== "suite_container") continue;
    const createdAt = Date.now();

    const tenants = parseTenantHintsFromRaw(row);
    tenants.forEach((tenant, index) => {
      expanded.push({
        id: childId(row.id, `${tenant.name || ""}|${tenant.url || ""}`, index),
        source: "directory",
        sourceUrl: tenant.url || row.sourceUrl,
        name: tenant.name,
        address: row.address,
        city: row.city,
        website: tenant.url,
        parentContainerName: row.name || row.parentContainerName,
        parentContainerAddress: row.address || row.parentContainerAddress,
        evidenceType: "directory_listing",
        raw: { generatedFrom: "container_tenants", containerId: row.id },
        createdAt,
      });
    });

    const extracted = row.extracted as Record<string, unknown> | undefined;
    const seeds = Array.isArray(extracted?.childQuerySeeds)
      ? (extracted?.childQuerySeeds as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [];
    seeds.forEach((seed, index) => {
      expanded.push({
        id: childId(row.id, seed, index + tenants.length),
        source: "directory",
        sourceUrl: row.sourceUrl,
        name: seed,
        city: row.city,
        parentContainerName: row.name || row.parentContainerName,
        parentContainerAddress: row.address || row.parentContainerAddress,
        evidenceType: "directory_listing",
        raw: { generatedFrom: "container_child_query_seed", seed, containerId: row.id },
        createdAt,
      });
    });
  }
  return expanded;
}

