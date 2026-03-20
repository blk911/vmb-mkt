/**
 * Filesystem catalog for beauty markets (`data/markets/*.json`).
 *
 * **Contract**
 * - All JSON reads go through here so path rules and “missing file” semantics live in one place.
 * - Missing files return `null` / empty structures — never throw (safe for Vercel when `.vercelignore` omits datasets).
 *
 * **Future**
 * - Add a parallel module (e.g. `firestoreCatalog.ts`) that returns the same shapes, then select via env
 *   or a small factory in `markets.ts` — without scattering `readFileSync` across the app.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function marketsDataDirAbs(): string {
  return path.join(process.cwd(), "data", "markets");
}

export function marketsJsonPath(...segments: string[]): string {
  return path.join(marketsDataDirAbs(), ...segments);
}

/**
 * Read JSON from disk. Returns `null` if the file is missing or JSON parse fails.
 */
export function readJsonIfExists<T>(absPath: string): T | null {
  if (!existsSync(absPath)) return null;
  try {
    return JSON.parse(readFileSync(absPath, "utf8")) as T;
  } catch {
    return null;
  }
}

/**
 * Prefer presence-merged enriched file, then plain enriched, then base `beauty_zone_members.json`.
 * (Used by `loadZoneMembers` in `markets.ts`.)
 */
export function resolveZoneMembersJsonPath(): string | null {
  const withPresence = marketsJsonPath("beauty_zone_members_enriched_with_presence.json");
  const enriched = marketsJsonPath("beauty_zone_members_enriched.json");
  const base = marketsJsonPath("beauty_zone_members.json");
  if (existsSync(withPresence)) return withPresence;
  if (existsSync(enriched)) return enriched;
  if (existsSync(base)) return base;
  return null;
}
