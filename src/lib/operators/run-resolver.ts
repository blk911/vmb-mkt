import { loadMaster } from "./master-store";
import { runMergePipeline } from "./run-merge";
import { resolveShelvedOperator } from "./resolver";
import type { SourceRecord } from "./types";

export async function runResolver() {
  console.log("Loading master...");
  const master = loadMaster();

  const shelved = master.filter((op) => op.status === "shelved");
  console.log(`Resolving ${shelved.length} shelved operators...`);

  const newSources: SourceRecord[] = [];

  for (const op of shelved.slice(0, 20)) {
    const results = await resolveShelvedOperator(op);
    newSources.push(...results);
  }

  console.log(`Recovered ${newSources.length} new source records`);

  if (newSources.length > 0) {
    await runMergePipeline(newSources);
  }

  console.log("Resolver run complete");
}

runResolver().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Resolver run failed: ${message}`);
  process.exit(1);
});
