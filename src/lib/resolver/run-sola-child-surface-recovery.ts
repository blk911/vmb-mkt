import fs from "node:fs";
import path from "node:path";
import { appendEvidence } from "@/lib/evidence/store";
import { sourceRecordsToEvidence } from "@/lib/evidence/ingest";
import { runAcquisition } from "@/lib/operators/run-acquisition";
import type { SourceRecord } from "@/lib/operators/types";
import { runGoogleSearch } from "@/lib/social-targets/operator-harvest/query-executor";
import { buildSolaChildSurfaceRecoveryQueries } from "./promotion-queries";
import { loadResolverRegistry } from "./registry-store";
import { runResolver } from "./run-resolver";
import type { ResolverOperator } from "./types";

const SUMMARY_PATH = path.join(process.cwd(), "runtime-data/sola_child_surface_recovery_summary.json");
// Diagnostic-only runner: Sola helps identity/linkage validation, not primary surface enrichment.
// Sola-derived child records are valuable for operator identity discovery and geo-linked tenant
// extraction, but they are not a reliable direct-source lane for website/booking/social recovery.

export type SolaChildSurfaceRecoverySummary = {
  generatedAt: string;
  attemptedChildren: number;
  evidenceAdded: number;
  upgradedWithInstagram: number;
  upgradedWithBooking: number;
  upgradedWithWebsite: number;
  promotedToHot: number;
  promotedToEnriched: number;
};

function isProvisionalName(value?: string): boolean {
  const text = (value || "").toLowerCase().trim();
  if (!text) return true;
  if (!text.includes(" ")) return true;
  return /(profile|provider|staff|member|artist|book|booking|detail|services?)/.test(text);
}

function isResolvedChild(op: ResolverOperator): boolean {
  if (!op.parentContainerId || op.isContainer) return false;
  return !isProvisionalName(op.canonicalName);
}

function isSolaChild(op: ResolverOperator): boolean {
  if (!op.parentContainerId) return false;
  const parentHints = [op.parentContainerName || "", ...op.sources.map((row) => row.parentContainerName || "")]
    .join(" ")
    .toLowerCase();
  if (parentHints.includes("sola")) return true;
  return op.sources.some((row) => {
    const url = (row.sourceUrl || "").toLowerCase();
    return url.includes("solasalons.com") || url.includes("solasalonstudios.com");
  });
}

function inferSourceFromUrl(url: string): SourceRecord["source"] {
  const lower = url.toLowerCase();
  if (lower.includes("instagram.com")) return "instagram";
  if (/(glossgenius|vagaro|booksy|fresha|styleseat|square\.site|squareup)/.test(lower)) return "booking";
  return "website";
}

function resultToCandidateRecord(op: ResolverOperator, url: string, query: string, snippet?: string): SourceRecord {
  return {
    source: inferSourceFromUrl(url),
    operatorType: "child_operator",
    sourceUrl: url,
    name: op.canonicalName,
    city: op.canonicalCity,
    category: op.category,
    address: op.canonicalAddress,
    phone: op.canonicalPhone,
    parentContainerId: op.parentContainerId,
    parentContainerName: op.parentContainerName || op.sources.find((row) => row.parentContainerName)?.parentContainerName,
    evidenceType: "direct_operator",
    raw: {
      from: "sola_child_surface_recovery",
      operatorId: op.id,
      query,
      snippet,
    },
    extracted: {
      operatorType: "child_operator",
      parentContainerId: op.parentContainerId,
      promotionMethod: "sola_child_surface_recovery",
      query,
    },
  };
}

function writeSummary(data: unknown): void {
  fs.mkdirSync(path.dirname(SUMMARY_PATH), { recursive: true });
  fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(data, null, 2)}\n`);
}

export async function runSolaChildSurfaceRecovery(
  opts?: { childLimit?: number; queryLimitPerChild?: number }
): Promise<SolaChildSurfaceRecoverySummary> {
  const childLimit = Math.max(1, Math.min(120, opts?.childLimit ?? 40));
  const queryLimitPerChild = Math.max(1, Math.min(5, opts?.queryLimitPerChild ?? 5));
  const before = loadResolverRegistry();
  const beforeMap = new Map(before.map((x) => [x.id, x]));

  const targets = before
    .filter((op) => isResolvedChild(op))
    .filter((op) => isSolaChild(op))
    .filter((op) => !op.canonicalBooking && !op.canonicalInstagram && !op.canonicalWebsite)
    .slice(0, childLimit);

  const candidates: SourceRecord[] = [];
  for (const target of targets) {
    const queries = buildSolaChildSurfaceRecoveryQueries(target).slice(0, queryLimitPerChild);
    for (const query of queries) {
      const hits = await runGoogleSearch(query, 3, { strictQuery: true });
      for (const hit of hits) {
        const url = (hit.link || "").trim();
        if (!url.startsWith("http")) continue;
        candidates.push(resultToCandidateRecord(target, url, query, hit.snippet));
      }
    }
  }

  const acquisition = await runAcquisition(candidates, {
    artifactPath: "runtime-data/sola_child_surface_recovery_acquisition_scan.json",
  });
  const extractedStrong = acquisition.enrichedRecords.filter((record) => {
    const hasDirectSurface = Boolean(record.booking || record.instagram || record.website);
    if (!hasDirectSurface) return false;
    return record.operatorType === "child_operator" || Boolean(record.parentContainerId);
  });
  const evidenceRows = sourceRecordsToEvidence(extractedStrong);
  appendEvidence(evidenceRows);

  const after = runResolver();
  const afterMap = new Map(after.map((x) => [x.id, x]));

  let upgradedWithInstagram = 0;
  let upgradedWithBooking = 0;
  let upgradedWithWebsite = 0;
  let promotedToHot = 0;
  let promotedToEnriched = 0;
  for (const target of targets) {
    const pre = beforeMap.get(target.id);
    const post = afterMap.get(target.id);
    if (!pre || !post) continue;
    if (!pre.canonicalInstagram && post.canonicalInstagram) upgradedWithInstagram += 1;
    if (!pre.canonicalBooking && post.canonicalBooking) upgradedWithBooking += 1;
    if (!pre.canonicalWebsite && post.canonicalWebsite) upgradedWithWebsite += 1;
    if (pre.status !== "hot" && post.status === "hot") promotedToHot += 1;
    if ((pre.status === "enumerated" || pre.status === "shelved") && post.status === "enriched") promotedToEnriched += 1;
  }

  const summary: SolaChildSurfaceRecoverySummary = {
    generatedAt: new Date().toISOString(),
    attemptedChildren: targets.length,
    evidenceAdded: evidenceRows.length,
    upgradedWithInstagram,
    upgradedWithBooking,
    upgradedWithWebsite,
    promotedToHot,
    promotedToEnriched,
  };
  writeSummary(summary);
  return summary;
}

if (require.main === module) {
  runSolaChildSurfaceRecovery()
    .then((summary) => {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    })
    .catch((error: unknown) => {
      process.stderr.write(`${String(error)}\n`);
      process.exitCode = 1;
    });
}
