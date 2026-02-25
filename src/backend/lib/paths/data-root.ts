// src/backend/lib/paths/data-root.ts
// Canonical data-root resolver for vmb-mkt.
// Goal: stop path drift between `data/...` and `backend/data/...`
// and stop filename drift between `licensees.json` and `vmb_licensees.json`.

import fs from "node:fs";
import path from "node:path";

function existsDir(p: string) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}
function existsFile(p: string) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

/**
 * Returns the repo root as an absolute path.
 * Uses process.cwd() which is the repo root when running from Next.js.
 */
export function repoRootAbs() {
  // In Next.js, process.cwd() is the repo root
  return process.cwd();
}

/**
 * Canonical data root.
 * We prefer `data/` at repo root if it exists.
 * Otherwise fall back to `backend/data/`.
 *
 * This removes "guessing" and makes writes/reads consistent.
 */
export function dataRootAbs() {
  const root = repoRootAbs();
  const a = path.join(root, "data");
  const b = path.join(root, "backend", "data");

  if (existsDir(a)) return a;
  if (existsDir(b)) return b;

  // Last resort: still return repoRoot/data (so callers see a clear ENOENT)
  return a;
}

/**
 * DORA tables directory for Denver Metro.
 * If you later parameterize county/region, this becomes a function input.
 */
export function doraDenverTablesAbs() {
  return path.join(dataRootAbs(), "co", "dora", "denver_metro", "tables");
}

/**
 * DORA derived directory for Denver Metro.
 * Contains computed indexes like tech_by_id.json and tech_ids_by_address.json
 */
export function doraDenverDerivedAbs() {
  return path.join(dataRootAbs(), "co", "dora", "denver_metro", "derived");
}

/**
 * Tech index directory for Denver Metro.
 * Contains tech-first truth indexes: index.json, by_license/, by_address/, etc.
 */
export function doraDenverTechIndexAbs() {
  return path.join(dataRootAbs(), "co", "dora", "denver_metro", "tech");
}

/**
 * Facilities directory for Denver Metro.
 * Contains facility data files like vmb_facilities.json.
 */
export function doraDenverFacilitiesAbs() {
  return path.join(dataRootAbs(), "co", "dora", "denver_metro", "tables");
}

/**
 * Resolve a table file by trying multiple known naming conventions.
 * Example: resolveDoraTableAbs("licensees") will check:
 * - licensees.json
 * - vmb_licensees.json
 */
export function resolveDoraTableAbs(baseName: string) {
  const dir = doraDenverTablesAbs();
  const candidates = [
    path.join(dir, `${baseName}.json`),
    path.join(dir, `vmb_${baseName}.json`),
  ];

  for (const c of candidates) {
    if (existsFile(c)) return c;
  }

  // Helpful error message with the exact folder we expected
  const msg =
    `Missing DORA table '${baseName}'. Tried:\n` +
    candidates.map(s => ` - ${s}`).join("\n") +
    `\n\nExpected tables dir:\n - ${dir}\n` +
    `Data root resolved to:\n - ${dataRootAbs()}\n`;

  const err = new Error(msg);
  (err as any).code = "DORA_TABLE_NOT_FOUND";
  throw err;
}
