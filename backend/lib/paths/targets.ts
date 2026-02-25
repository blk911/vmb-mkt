import path from "node:path";
import { dataRootAbs } from "@/backend/lib/paths/data-root";

export function doraDenverTargetsDirAbs() {
  return path.join(dataRootAbs(), "co", "dora", "denver_metro", "targets");
}

export function doraDenverTargetListsDirAbs() {
  return path.join(doraDenverTargetsDirAbs(), "lists");
}

export function doraDenverTargetIndexAbs() {
  return path.join(doraDenverTargetsDirAbs(), "target_lists.json");
}
