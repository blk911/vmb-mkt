import { loadResolverRegistryForUi } from "@/lib/resolver/registry-store";
import type { ResolverOperator } from "@/lib/resolver/types";
import { applyReviewOverlay, resolverOperatorToOperatorRecord } from "./review-store";
import type { OperatorRecord } from "./types";

export type ChildState = "not_child" | "provisional_child" | "resolved_child";

export type OperatorConsoleRow = OperatorRecord & {
  resolverStatus: ResolverOperator["status"];
  childState: ChildState;
  isContainer: boolean;
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

export function loadOperatorsFromResolverRegistry(): OperatorConsoleRow[] {
  const resolverRows = loadResolverRegistryForUi();
  const mapped = resolverRows.map((row) => {
    const operator = resolverOperatorToOperatorRecord(row);
    return {
      ...operator,
      resolverStatus: row.status,
      childState: deriveChildState(row),
      isContainer: Boolean(row.isContainer),
    };
  });
  return applyReviewOverlay(mapped) as OperatorConsoleRow[];
}

