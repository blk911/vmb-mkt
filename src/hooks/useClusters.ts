import { useMemo } from "react";
import { buildClusters } from "@/lib/cluster/cluster-builder";
import type { BaseEntity } from "@/lib/cluster/types";

export function useClusters(data: BaseEntity[]) {
  return useMemo(() => buildClusters(data || []), [data]);
}
