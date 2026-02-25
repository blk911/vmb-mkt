import path from "node:path";
import fs from "node:fs/promises";

export function repoRoot() {
  return process.cwd();
}

export function dataDir() {
  return path.join(repoRoot(), "data");
}

export function vmbTablesDir() {
  return path.join(dataDir(), "co", "dora", "denver_metro", "tables");
}

export async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

export async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export function die(msg) {
  console.error(msg);
  process.exit(1);
}
