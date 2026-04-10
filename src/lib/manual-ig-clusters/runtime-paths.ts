import path from "node:path";

const RUNTIME_DIR = path.join(process.cwd(), "runtime-data");

export function manualIgClustersDirPath(): string {
  return path.join(RUNTIME_DIR, "manual-ig-clusters.generated");
}

export function manualIgClusterFilePath(clusterId: string): string {
  return path.join(manualIgClustersDirPath(), `cluster_${clusterId}.json`);
}

export function manualIgAcceptedStorePath(): string {
  return path.join(RUNTIME_DIR, "manual-ig-accepted.generated.json");
}
