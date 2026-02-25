import path from "node:path";
import { dataRootAbs as canonicalDataRootAbs } from "@/backend/lib/paths/data-root";

/**
 * @deprecated Use @/backend/lib/paths/data-root instead
 * Kept for backward compatibility with existing code
 */
export function dataRootAbs() {
  return canonicalDataRootAbs();
}

export function targetsDirAbs() {
  return path.join(dataRootAbs(), "co", "dora", "denver_metro", "targets");
}
