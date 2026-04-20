import fs from "node:fs";
import path from "node:path";
import { getRuntimeDataRoot } from "@/lib/runtime/runtime-data-root";
import type { ResolverOperator } from "./types";

const RUNTIME_ROOT = getRuntimeDataRoot();
const REGISTRY_PATH = path.join(RUNTIME_ROOT, "resolver_registry.v1.json");
const REGISTRY_UI_PATH = path.join(RUNTIME_ROOT, "resolver_registry.ui.v1.json");
const SUMMARY_PATH = path.join(RUNTIME_ROOT, "resolver_summary.json");
const SURFACE_RECOVERY_QUEUE_PATH = path.join(RUNTIME_ROOT, "operator_surface_recovery_queue.json");

function readResolverRegistryFile(filePath: string): ResolverOperator[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
    return Array.isArray(parsed) ? (parsed as ResolverOperator[]) : [];
  } catch {
    return [];
  }
}

export function loadResolverRegistry(): ResolverOperator[] {
  return readResolverRegistryFile(REGISTRY_PATH);
}

export function saveResolverRegistry(operators: ResolverOperator[]): void {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, `${JSON.stringify(operators, null, 2)}\n`);
  fs.writeFileSync(REGISTRY_UI_PATH, `${JSON.stringify(toUiResolverRegistry(operators), null, 2)}\n`);
}

export function loadResolverRegistryForUi(): ResolverOperator[] {
  const target = fs.existsSync(REGISTRY_UI_PATH) ? REGISTRY_UI_PATH : REGISTRY_PATH;
  return readResolverRegistryFile(target);
}

export function saveResolverSummary(input: {
  evidenceCount: number;
  operators: ResolverOperator[];
  preCompactionOperatorCount?: number;
  postCompactionOperatorCount?: number;
  compactedDuplicateCount?: number;
}): void {
  const { evidenceCount, operators } = input;
  const childOperators = operators.filter((x) => !x.isContainer && Boolean(x.parentContainerId));
  const summary = {
    generatedAt: new Date().toISOString(),
    evidenceCount,
    operatorCount: operators.length,
    hotCount: operators.filter((x) => x.status === "hot").length,
    enrichedCount: operators.filter((x) => x.status === "enriched").length,
    enumeratedCount: operators.filter((x) => x.status === "enumerated").length,
    containerCount: operators.filter((x) => x.isContainer).length,
    childOperatorCount: childOperators.length,
    childWithBookingCount: childOperators.filter((x) => Boolean(x.canonicalBooking)).length,
    childWithInstagramCount: childOperators.filter((x) => Boolean(x.canonicalInstagram)).length,
    childWithWebsiteCount: childOperators.filter((x) => Boolean(x.canonicalWebsite)).length,
    childWeakCount: childOperators.filter((x) => !x.canonicalBooking && !x.canonicalInstagram && !x.canonicalWebsite).length,
    preCompactionOperatorCount: input.preCompactionOperatorCount ?? operators.length,
    postCompactionOperatorCount: input.postCompactionOperatorCount ?? operators.length,
    compactedDuplicateCount: input.compactedDuplicateCount ?? 0,
  };
  fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);
}

export function writeSurfaceRecoveryQueueArtifact(queue: unknown): string {
  fs.mkdirSync(path.dirname(SURFACE_RECOVERY_QUEUE_PATH), { recursive: true });
  fs.writeFileSync(SURFACE_RECOVERY_QUEUE_PATH, `${JSON.stringify(queue, null, 2)}\n`);
  return SURFACE_RECOVERY_QUEUE_PATH;
}

function toUiResolverRegistry(operators: ResolverOperator[]): ResolverOperator[] {
  return operators.map((op) => ({
    ...op,
    sources: (op.sources || []).map((row) => ({
      id: row.id,
      source: row.source,
      sourceUrl: row.sourceUrl,
      parentContainerName: row.parentContainerName,
      evidenceType: row.evidenceType,
      raw:
        row.raw && typeof row.raw === "object" && "promotionMethod" in (row.raw as Record<string, unknown>)
          ? { promotionMethod: (row.raw as Record<string, unknown>).promotionMethod }
          : undefined,
      extracted: undefined,
      createdAt: row.createdAt,
    })),
  }));
}

