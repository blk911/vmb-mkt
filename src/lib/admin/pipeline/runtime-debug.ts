import os from "node:os";
import { getCanonicalPipelineStoreMode } from "@/lib/admin/pipeline/canonical-store-config";
import { getRuntimeDataRoot } from "@/lib/runtime/runtime-data-root";
import { listDoraQueue, listSocialQueue } from "@/lib/source-intake/phase2-store";

export type RuntimeStoreDescriptor = {
  runtimeRoot: string;
  canonicalStoreMode: "file" | "firestore";
  storageMode: "explicit_runtime_root" | "vercel_tmp" | "workspace_runtime_data";
  environment: "vercel" | "local";
  instanceHost: string;
  instancePid: number;
};

export type BuildSubmitDebugInfo = RuntimeStoreDescriptor & {
  submittedAt: string;
  submitOutcome: "success" | "error";
  intakeId?: string;
  recordsReceived?: number;
  doraQueued?: number;
  socialQueued?: number;
};

export type ValidationLoadDebugInfo = RuntimeStoreDescriptor & {
  checkedAt: string;
  doraQueueCount: number;
  socialQueueCount: number;
  latestDoraQueueItemId?: string;
  latestDoraQueueCreatedAt?: string;
  latestSocialQueueItemId?: string;
  latestSocialQueueCreatedAt?: string;
};

export function getRuntimeStoreDescriptor(): RuntimeStoreDescriptor {
  return {
    runtimeRoot: getRuntimeDataRoot(),
    canonicalStoreMode: getCanonicalPipelineStoreMode(),
    storageMode: process.env.VMB_RUNTIME_DATA_ROOT?.trim()
      ? "explicit_runtime_root"
      : process.env.VERCEL
        ? "vercel_tmp"
        : "workspace_runtime_data",
    environment: process.env.VERCEL ? "vercel" : "local",
    instanceHost: os.hostname(),
    instancePid: process.pid,
  };
}

export async function getValidationLoadDebugInfo(): Promise<ValidationLoadDebugInfo> {
  const [doraQueue, socialQueue] = await Promise.all([listDoraQueue(), listSocialQueue()]);
  const latestDora = doraQueue[0];
  const latestSocial = socialQueue[0];

  return {
    ...getRuntimeStoreDescriptor(),
    checkedAt: new Date().toISOString(),
    doraQueueCount: doraQueue.length,
    socialQueueCount: socialQueue.length,
    latestDoraQueueItemId: latestDora?.id,
    latestDoraQueueCreatedAt: latestDora?.createdAt,
    latestSocialQueueItemId: latestSocial?.id,
    latestSocialQueueCreatedAt: latestSocial?.createdAt,
  };
}
