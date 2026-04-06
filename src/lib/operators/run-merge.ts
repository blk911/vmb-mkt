import fs from "node:fs";
import path from "node:path";
import { mergeSources } from "./merge";
import { validateInstagram, validateBooking, validateWebsite } from "./validators";
import { assignStatus } from "./status";
import { loadMaster, saveMaster } from "./master-store";
import { getOutreachTargets } from "./outreach";
import type { SourceRecord, OperatorRecord } from "./types";
import { normalizeName } from "./normalize";
import { applyReviewOverlay } from "./review-store";
import { writeReadyCoreArtifact } from "./ready-core";

export async function runMergePipeline(allSources: SourceRecord[]) {
  const existing = loadMaster();
  const existingSources: SourceRecord[] = existing.flatMap((op) => {
    if (Array.isArray(op.evidence) && op.evidence.length > 0) return op.evidence;
    return Object.values(op.sources).filter(Boolean) as SourceRecord[];
  });
  const combinedSources = [...existingSources, ...allSources];
  const filteredSources = combinedSources.filter((s) => {
    const normalized = normalizeName(s.name);
    if (normalized) return true;
    // Keep valid directory/container evidence even when title-level names are unknown.
    if ((s.evidenceType === "directory_listing" || s.evidenceType === "suite_container") && (s.sourceUrl || s.website || s.booking)) {
      return true;
    }
    return false;
  });
  console.log("STEP 1: merging sources...");
  const merged: OperatorRecord[] = mergeSources(filteredSources);
  console.log("STEP 2: validating...");
  for (const op of merged) {
    op.validation.instagramStatus = await validateInstagram(op.canonical.instagram);
    op.validation.bookingStatus = await validateBooking(op.canonical.booking);
    op.validation.websiteStatus = await validateWebsite(op.canonical.website);
  }
  console.log("STEP 3: assigning status...");
  const final = merged.map(assignStatus);
  console.log("STEP 4: saving master...");
  saveMaster(final);
  const reviewOverlaid = applyReviewOverlay(final);
  writeReadyCoreArtifact(reviewOverlaid);
  const topTargets = getOutreachTargets(final);
  const OUT_PATH = path.join(process.cwd(), "runtime-data/operator_outreach_top25.json");
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(topTargets, null, 2)}\n`);
  console.log(`Top outreach targets written: ${topTargets.length}`);
  console.log({
    total: final.length,
    hot: final.filter((o) => o.status === "hot").length,
    shelved: final.filter((o) => o.status === "shelved").length,
    discard: final.filter((o) => o.status === "discard").length,
  });
  console.log(`DONE: ${final.length} operators processed`);
  return final;
}
