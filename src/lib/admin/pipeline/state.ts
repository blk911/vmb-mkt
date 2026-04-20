import { listSourceIntakes } from "@/lib/source-intake/store";
import { listCanonicalOperators } from "@/lib/admin/operator-adapter";
import { listAdminActions } from "./logging";
import { listOutreachQueue } from "./outreach-queue";
import type { AdminActionLogEntry, AdminDashboardMetrics, ValidationQueueRow } from "./types";
import { listValidationRows } from "./validation";

const TERMINAL_VALIDATION_STATUSES = new Set(["approved", "merged", "rejected", "failed", "dismissed"]);

export function isPendingValidationRow(row: ValidationQueueRow): boolean {
  return !TERMINAL_VALIDATION_STATUSES.has(row.status);
}

export function summarizeValidationRows(rows: ValidationQueueRow[]) {
  const pending = rows.filter(isPendingValidationRow);
  const approved = rows.filter((row) => row.status === "approved");
  const merged = rows.filter((row) => row.status === "merged");
  const rejected = rows.filter((row) => row.status === "rejected");
  const pendingBySource = pending.reduce<Record<string, number>>((acc, row) => {
    acc[row.sourceType] = (acc[row.sourceType] || 0) + 1;
    return acc;
  }, {});

  return {
    pending,
    approved,
    merged,
    rejected,
    pendingBySource,
  };
}

export async function listPendingValidationRows(): Promise<ValidationQueueRow[]> {
  const rows = await listValidationRows();
  return rows.filter(isPendingValidationRow);
}

export type PipelineOperationalSnapshot = {
  metrics: AdminDashboardMetrics;
  pendingBySource: Record<string, number>;
  approvedCount: number;
  mergedCount: number;
  rejectedCount: number;
  outreachCount: number;
  recentValidationRows: ValidationQueueRow[];
  recentAdminActions: AdminActionLogEntry[];
};

export async function getPipelineOperationalSnapshot(): Promise<PipelineOperationalSnapshot> {
  const [intakes, validationRows, canonicalOperators, outreachRows, recentAdminActions] = await Promise.all([
    listSourceIntakes(),
    listValidationRows(),
    listCanonicalOperators(),
    listOutreachQueue(),
    listAdminActions(20),
  ]);

  const summary = summarizeValidationRows(validationRows);
  const eligibleTargets = canonicalOperators.filter((row) => row.status === "approved");

  return {
    metrics: {
      newInputs: intakes.length,
      pendingValidation: summary.pending.length,
      readyTargets: eligibleTargets.length,
      activeOutreach: outreachRows.length,
    },
    pendingBySource: summary.pendingBySource,
    approvedCount: summary.approved.length,
    mergedCount: summary.merged.length,
    rejectedCount: summary.rejected.length,
    outreachCount: outreachRows.length,
    recentValidationRows: [...validationRows]
      .sort((a, b) => (b.resolvedAt || b.createdAt).localeCompare(a.resolvedAt || a.createdAt))
      .slice(0, 12),
    recentAdminActions,
  };
}
