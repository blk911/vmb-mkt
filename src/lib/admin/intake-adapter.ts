import { buildRequestConfig, normalizeBuildResponse } from "@/lib/admin/pipeline/build";
import type { BuildSourceType, BuildSubmissionSummary } from "@/lib/admin/pipeline/types";

type UnifiedIntakeRequest = {
  sourceType: BuildSourceType;
  rawText: string;
  origin: string;
};

type QueueSummary = {
  intakeId: string;
  candidatesCreated: number;
  doraQueued: number;
  socialQueued: number;
};

export type UnifiedIntakeResult =
  | {
      ok: true;
      endpoint: string;
      summary: BuildSubmissionSummary;
      queue: QueueSummary;
      raw: unknown;
    }
  | {
      ok: false;
      endpoint?: string;
      error: string;
    };

function absolutize(origin: string, path: string): string {
  return new URL(path, origin).toString();
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return response.json().catch(() => ({ ok: false, error: "invalid_response" }));
}

export async function submitUnifiedIntake(args: UnifiedIntakeRequest): Promise<UnifiedIntakeResult> {
  const { endpoint, body } = buildRequestConfig(args.sourceType, args.rawText);
  const ingestionData = await postJson(absolutize(args.origin, endpoint), body);
  const normalized = normalizeBuildResponse(args.sourceType, endpoint, ingestionData);
  if (!normalized.ok) return normalized;

  const queueData = (await postJson(absolutize(args.origin, "/api/admin/pipeline/build-to-queue"), {
    sourceType: args.sourceType,
    rawText: args.rawText,
  })) as {
    ok?: boolean;
    error?: string;
    summary?: QueueSummary;
  };

  if (!queueData.ok || !queueData.summary) {
    return {
      ok: false,
      endpoint,
      error: typeof queueData.error === "string" ? queueData.error : "queue_adapter_failed",
    };
  }

  return {
    ok: true,
    endpoint,
    summary: {
      ...normalized.summary,
      notes: [
        ...(normalized.summary.notes || []),
        `validationCandidates: ${queueData.summary.candidatesCreated}`,
        `doraQueued: ${queueData.summary.doraQueued}`,
        `socialQueued: ${queueData.summary.socialQueued}`,
        `intakeId: ${queueData.summary.intakeId}`,
      ],
    },
    queue: queueData.summary,
    raw: normalized.raw,
  };
}
