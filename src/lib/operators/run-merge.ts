import fs from "node:fs";
import path from "node:path";
import { mergeSources } from "./merge";
import { validateInstagram, validateBooking, validateWebsite } from "./validators";
import { assignStatus } from "./status";
import { loadMaster, saveMaster } from "./master-store";
import { getOutreachTargets } from "./outreach";
import type { SourceRecord, OperatorRecord } from "./types";

export async function runMergePipeline(allSources: SourceRecord[]) {
  const existing = loadMaster();
  const existingSources: SourceRecord[] = existing.flatMap((op) => {
    return [op.sources.google, op.sources.instagram, op.sources.booking].filter(Boolean) as SourceRecord[];
  });
  const combinedSources = [...existingSources, ...allSources];
  console.log("STEP 1: merging sources...");
  const merged: OperatorRecord[] = mergeSources(combinedSources);
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
