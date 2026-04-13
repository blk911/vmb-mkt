import path from "node:path";
import { getRuntimeDataRoot } from "@/lib/runtime/runtime-data-root";

const RUNTIME_DIR = getRuntimeDataRoot();

export function solaContainersStorePath(): string {
  return path.join(RUNTIME_DIR, "sola-containers.generated.json");
}

export function solaTenantsStorePath(): string {
  return path.join(RUNTIME_DIR, "sola-tenants.generated.json");
}
