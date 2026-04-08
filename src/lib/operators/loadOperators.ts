import { loadResolverRegistryForUi } from "@/lib/resolver/registry-store";
import type { ResolverOperator } from "@/lib/resolver/types";
import { applyReviewOverlay, resolverOperatorToOperatorRecord } from "./review-store";
import type { OperatorRecord } from "./types";

export type ChildState = "not_child" | "provisional_child" | "resolved_child";

export type OperatorConsoleRow = OperatorRecord & {
  resolverStatus: ResolverOperator["status"];
  operatorType: "operator" | "container" | "child_operator";
  childState: ChildState;
  isContainer: boolean;
  parentContainerId?: string;
  parentContainerName?: string;
  sourceTypeSummary: string;
  evidenceCount: number;
};

function provisionalName(value?: string): boolean {
  const name = (value || "").toLowerCase().trim();
  if (!name) return true;
  if (!name.includes(" ")) return true;
  return /(profile|provider|staff|member|artist|book|booking|detail|services?)/.test(name);
}

function deriveChildState(op: ResolverOperator): ChildState {
  if (!op.parentContainerId) return "not_child";
  return provisionalName(op.canonicalName) ? "provisional_child" : "resolved_child";
}

function containerNameFromDomain(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("solasalonstudios.com") || host.includes("solasalons.com")) return "Sola Salons";
    if (host.includes("phenixsalonsuites.com")) return "Phenix Salon Suites";
    if (host.includes("mysalonsuite.com")) return "My Salon Suite";
    if (host.includes("solerasalons.com")) return "Solera Salon";
    if (host.includes("spectrasalons.com")) return "Spectra Salon";
  } catch {
    // ignore invalid urls
  }
  return undefined;
}

function isUsableParentContainerName(value?: string): boolean {
  const text = (value || "").trim();
  if (!text) return false;
  if (text.length > 120) return false;
  if (text.includes(".css-") || text.includes("{") || text.includes("}")) return false;
  if (/(wmmqb6|1ay9vb9|1d3bbye|display:-we)/i.test(text)) return false;
  return true;
}

function normalizeParentContainerHint(value?: string): string | undefined {
  if (!isUsableParentContainerName(value)) return undefined;
  const text = (value || "").trim();
  const lower = text.toLowerCase();
  if (lower.includes("sola")) return "Sola Salons";
  if (lower.includes("phenix")) return "Phenix Salon Suites";
  if (lower.includes("my salon suite") || lower.includes("mysalonsuite")) return "My Salon Suite";
  if (lower.includes("solera")) return "Solera Salon";
  if (lower.includes("spectra")) return "Spectra Salon";
  return text;
}

function sourceTypes(op: ResolverOperator): string[] {
  const tags = new Set<string>();
  for (const row of op.sources || []) {
    if (row.source) tags.add(row.source);
    if (row.evidenceType === "directory_listing") tags.add("directory");
    if (row.evidenceType === "suite_container") tags.add("container");
  }
  return [...tags];
}

function deriveOperatorType(op: ResolverOperator): "operator" | "container" | "child_operator" {
  if (op.operatorType) return op.operatorType;
  if (op.isContainer) return "container";
  if (op.parentContainerId) return "child_operator";
  const hasContainerEvidence = (op.sources || []).some((row) => row.evidenceType === "suite_container" || row.source === "container");
  if (hasContainerEvidence) return "container";
  return "operator";
}

function deriveParentContainerName(
  op: ResolverOperator,
  containerNameById: Map<string, string>
): string | undefined {
  if (op.parentContainerId && containerNameById.has(op.parentContainerId)) return containerNameById.get(op.parentContainerId);
  const domainHint = (op.sources || []).map((row) => containerNameFromDomain(row.sourceUrl)).find(Boolean);
  if (domainHint) return domainHint;
  const canonicalHint = normalizeParentContainerHint(op.parentContainerName);
  if (canonicalHint) return canonicalHint;
  const evidenceHint = (op.sources || [])
    .map((row) => normalizeParentContainerHint(row.parentContainerName))
    .find((value) => Boolean(value));
  return evidenceHint || undefined;
}

export function loadOperatorsFromResolverRegistry(): OperatorConsoleRow[] {
  const resolverRows = loadResolverRegistryForUi();
  const containerNameById = new Map<string, string>();
  for (const row of resolverRows) {
    const name = row.canonicalName || row.parentContainerName;
    if (row.isContainer && row.id && name) containerNameById.set(row.id, name);
  }
  const mapped = resolverRows.map((row) => {
    const operator = resolverOperatorToOperatorRecord(row);
    const sourceTypeSummary = sourceTypes(row).join(" / ");
    const evidenceCount = Array.isArray(operator.evidence) ? operator.evidence.length : 0;
    return {
      ...operator,
      resolverStatus: row.status,
      operatorType: deriveOperatorType(row),
      childState: deriveChildState(row),
      isContainer: Boolean(row.isContainer),
      parentContainerId: row.parentContainerId,
      parentContainerName: deriveParentContainerName(row, containerNameById),
      sourceTypeSummary,
      evidenceCount,
    };
  });
  return applyReviewOverlay(mapped) as OperatorConsoleRow[];
}

