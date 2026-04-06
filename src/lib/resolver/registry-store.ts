import fs from "node:fs";
import path from "node:path";
import type { ResolverOperator } from "./types";

const REGISTRY_PATH = path.join(process.cwd(), "runtime-data/resolver_registry.v1.json");

export function loadResolverRegistry(): ResolverOperator[] {
  if (!fs.existsSync(REGISTRY_PATH)) return [];
  const parsed = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8")) as unknown;
  return Array.isArray(parsed) ? (parsed as ResolverOperator[]) : [];
}

export function saveResolverRegistry(operators: ResolverOperator[]): void {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, `${JSON.stringify(operators, null, 2)}\n`);
}

