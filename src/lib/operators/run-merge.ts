import { mergeSources } from "@/lib/operators/merge";
import { validateInstagram, validateBooking, validateWebsite } from "@/lib/operators/validators";
import { assignStatus } from "@/lib/operators/status";
import { saveMaster } from "@/lib/operators/master-store";
import type { SourceRecord, OperatorRecord } from "@/lib/operators/types";

export async function runMergePipeline(allSources: SourceRecord[]) {
  console.log("STEP 1: merging sources...");
  const merged: OperatorRecord[] = mergeSources(allSources);
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
  console.log(`DONE: ${final.length} operators processed`);
  return final;
}
