import type { AdminDashboardMetrics } from "./types";
import { getPipelineOperationalSnapshot } from "./state";

export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const snapshot = await getPipelineOperationalSnapshot();
  return snapshot.metrics;
}
