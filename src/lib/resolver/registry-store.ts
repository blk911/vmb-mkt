import fs from "node:fs";
import path from "node:path";
import type { ResolverOperator } from "./types";

const REGISTRY_PATH = path.join(process.cwd(), "runtime-data/resolver_registry.v1.json");
const SUMMARY_PATH = path.join(process.cwd(), "runtime-data/resolver_summary.json");

export function loadResolverRegistry(): ResolverOperator[] {
  if (!fs.existsSync(REGISTRY_PATH)) return [];
  const parsed = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8")) as unknown;
  return Array.isArray(parsed) ? (parsed as ResolverOperator[]) : [];
}

export function saveResolverRegistry(operators: ResolverOperator[]): void {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, `${JSON.stringify(operators, null, 2)}\n`);
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

