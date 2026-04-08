import fs from "node:fs";
import path from "node:path";

export type RuntimeTraceStatus = "start" | "success" | "timeout" | "error" | "skipped" | "accepted" | "rejected";

export type RuntimeTraceEvent = {
  ts: string;
  runId: string;
  operatorId?: string;
  operatorName?: string;
  query?: string;
  stage: string;
  status: RuntimeTraceStatus;
  elapsedMs?: number;
  url?: string;
  note?: string;
  intent?: string;
  candidateStrength?: number;
};

const TRACE_PATH = path.join(process.cwd(), "runtime-data/directory_backed_runtime_trace.jsonl");

export class RuntimeTraceLogger {
  readonly runId: string;
  readonly outputPath: string;
  private readonly slowStageThresholdMs: number;
  private readonly stageElapsedTotals = new Map<string, number>();
  private readonly slowStageCounts = new Map<string, number>();

  constructor(input?: { runId?: string; outputPath?: string; resetFile?: boolean; slowStageThresholdMs?: number }) {
    this.runId = input?.runId || `directory-backed-${Date.now()}`;
    this.outputPath = input?.outputPath || TRACE_PATH;
    this.slowStageThresholdMs = input?.slowStageThresholdMs ?? 2000;
    fs.mkdirSync(path.dirname(this.outputPath), { recursive: true });
    if (input?.resetFile !== false) fs.writeFileSync(this.outputPath, "");
  }

  log(event: Omit<RuntimeTraceEvent, "ts" | "runId">): void {
    const payload: RuntimeTraceEvent = {
      ts: new Date().toISOString(),
      runId: this.runId,
      ...event,
    };
    if (typeof payload.elapsedMs === "number") {
      this.stageElapsedTotals.set(payload.stage, (this.stageElapsedTotals.get(payload.stage) ?? 0) + payload.elapsedMs);
      if (payload.elapsedMs >= this.slowStageThresholdMs || payload.status === "timeout" || payload.status === "error") {
        this.slowStageCounts.set(payload.stage, (this.slowStageCounts.get(payload.stage) ?? 0) + 1);
      }
    } else if (payload.status === "timeout" || payload.status === "error") {
      this.slowStageCounts.set(payload.stage, (this.slowStageCounts.get(payload.stage) ?? 0) + 1);
    }
    fs.appendFileSync(this.outputPath, `${JSON.stringify(payload)}\n`);
  }

  summary(): {
    dominantSlowStage: string;
    slowStageCounts: Record<string, number>;
  } {
    const counts = Object.fromEntries([...this.slowStageCounts.entries()].sort((a, b) => b[1] - a[1]));
    const dominant =
      [...this.stageElapsedTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ||
      Object.keys(counts)[0] ||
      "none";
    return {
      dominantSlowStage: dominant,
      slowStageCounts: counts,
    };
  }
}
