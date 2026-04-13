import path from "node:path";
import { getRuntimeDataRoot } from "@/lib/runtime/runtime-data-root";

const RUNTIME_DIR = getRuntimeDataRoot();

export function manualIgClustersDirPath(): string {
  return path.join(RUNTIME_DIR, "manual-ig-clusters.generated");
}

export function manualIgClusterFilePath(clusterId: string): string {
  return path.join(manualIgClustersDirPath(), `cluster_${clusterId}.json`);
}

export function manualIgAcceptedStorePath(): string {
  return path.join(RUNTIME_DIR, "manual-ig-accepted.generated.json");
}
