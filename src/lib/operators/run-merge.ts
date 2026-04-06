import fs from "node:fs";
import path from "node:path";
import { validateInstagram, validateBooking, validateWebsite } from "./validators";
import { saveMaster } from "./master-store";
import { getOutreachTargets } from "./outreach";
import type { SourceRecord, OperatorRecord } from "./types";
import { applyReviewOverlay } from "./review-store";
import { writeReadyCoreArtifact } from "./ready-core";
import { loadResolverRegistry } from "@/lib/resolver/registry-store";
import type { ResolverOperator } from "@/lib/resolver/types";
import type { EvidenceRecord } from "@/lib/evidence/types";

function evidenceToSource(e: EvidenceRecord): SourceRecord {
  return {
    source: e.source,
    sourceUrl: e.sourceUrl,
    name: e.name,
    city: e.city,
    address: e.address,
    phone: e.phone,
    website: e.website,
    instagram: e.instagram,
    booking: e.booking,
    parentContainerName: e.parentContainerName,
    evidenceType: e.evidenceType,
    extractedFromUrl: e.sourceUrl,
    childQuerySeeds:
      e.extracted && typeof e.extracted === "object" && Array.isArray((e.extracted as { childQuerySeeds?: unknown }).childQuerySeeds)
        ? (((e.extracted as { childQuerySeeds?: unknown }).childQuerySeeds as unknown[]).filter((x): x is string => typeof x === "string"))
        : undefined,
  };
}

function mapResolverStatus(status: ResolverOperator["status"]): OperatorRecord["status"] {
  if (status === "hot" || status === "ready") return "hot";
  if (status === "shelved") return "shelved";
  return "shelved";
}

function resolverToOperator(op: ResolverOperator): OperatorRecord {
  const sources = op.sources.map(evidenceToSource);
  const bySource: OperatorRecord["sources"] = {};
  for (const src of sources) {
    bySource[src.source] = src;
  }

  return {
    id: op.id,
    name: op.canonicalName || "unknown",
    city: op.canonicalCity,
    category: op.category,
    sources: bySource,
    evidence: sources,
    canonical: {
      instagram: op.canonicalInstagram,
      booking: op.canonicalBooking,
      website: op.canonicalWebsite,
      phone: op.canonicalPhone,
    },
    validation: {
      instagramStatus: "missing",
      bookingStatus: "missing",
      websiteStatus: "missing",
    },
    status: mapResolverStatus(op.status),
    confidenceScore: op.confidenceScore,
    lastUpdatedAt: new Date(op.updatedAt).toISOString(),
  };
}

export async function runMergePipeline(_allSources: SourceRecord[]) {
  void _allSources;
  console.log("STEP 1: loading resolver registry...");
  const resolverOperators = loadResolverRegistry();
  const merged: OperatorRecord[] = resolverOperators.map(resolverToOperator);

  console.log("STEP 2: validating...");
  for (const op of merged) {
    op.validation.instagramStatus = await validateInstagram(op.canonical.instagram);
    op.validation.bookingStatus = await validateBooking(op.canonical.booking);
    op.validation.websiteStatus = await validateWebsite(op.canonical.website);
  }

  console.log("STEP 3: saving master from resolver...");
  saveMaster(merged);
  const reviewOverlaid = applyReviewOverlay(merged);
  writeReadyCoreArtifact(reviewOverlaid);
  const topTargets = getOutreachTargets(reviewOverlaid);
  const OUT_PATH = path.join(process.cwd(), "runtime-data/operator_outreach_top25.json");
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(topTargets, null, 2)}\n`);
  console.log(`Top outreach targets written: ${topTargets.length}`);
  console.log({
    total: merged.length,
    hot: merged.filter((o) => o.status === "hot").length,
    shelved: merged.filter((o) => o.status === "shelved").length,
    discard: merged.filter((o) => o.status === "discard").length,
  });
  console.log(`DONE: ${merged.length} operators processed`);
  return merged;
}
