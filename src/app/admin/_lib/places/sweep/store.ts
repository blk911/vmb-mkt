import fs from "fs";
import path from "path";

import { getWritableDataRoot } from "./writableRoot";

type SweepRow = {
  addressKey: string;
  addressClass?: string;
  confidence?: number;
  reasons?: string[];
  topCandidate?: any;
  sweepCandidates?: any[];
  geocode?: Record<string, any>;
  context?: Record<string, any>;
  adjudication?: {
    decision?: string | null;
    decidedAt?: string | null;
    candidate?: any;
  };
};

type SweepDoc = {
  ok: true;
  kind: "address_sweep_effective";
  version: "v1";
  counts: Record<string, number>;
  rows: SweepRow[];
  updatedAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

function writableDerivedDirAbs() {
  const base = getWritableDataRoot();
  return path.join(base, "co", "dora", "denver_metro", "places", "derived");
}

function bundledDerivedDirAbs() {
  return path.join(process.cwd(), "data", "co", "dora", "denver_metro", "places", "derived");
}

function effectiveAbsFrom(rootDerivedDir: string) {
  return path.join(rootDerivedDir, "address_sweep_effective.v1.json");
}

function candidatesAbsFrom(rootDerivedDir: string) {
  return path.join(rootDerivedDir, "address_sweep_candidates.v1.json");
}

function ensureDirForFile(absPath: string) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
}

function readJsonSafe(absPath: string) {
  try {
    if (!fs.existsSync(absPath)) return null;
    const raw = fs.readFileSync(absPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(absPath: string, value: any) {
  ensureDirForFile(absPath);
  fs.writeFileSync(absPath, JSON.stringify(value, null, 2), "utf8");
}

function computeCounts(rows: SweepRow[]) {
  const counts: Record<string, number> = {
    rows: rows.length,
    storefront: 0,
    suite_center: 0,
    maildrop: 0,
    residential: 0,
    unknown: 0,
  };

  for (const row of rows) {
    const k = String(row?.addressClass || "unknown");
    if (counts[k] == null) counts[k] = 0;
    counts[k] += 1;
  }
  return counts;
}

function normalizeDoc(input: any): SweepDoc {
  const rows: SweepRow[] = Array.isArray(input?.rows) ? input.rows : [];
  return {
    ok: true,
    kind: "address_sweep_effective",
    version: "v1",
    rows,
    counts: computeCounts(rows),
    updatedAt: String(input?.updatedAt || nowIso()),
  };
}

export function readSweepEffective(): SweepDoc {
  const writable = effectiveAbsFrom(writableDerivedDirAbs());
  const fromWritable = readJsonSafe(writable);
  if (fromWritable) return normalizeDoc(fromWritable);

  // Fallback: on serverless, bundled artifacts can be readable but not writable.
  const bundled = effectiveAbsFrom(bundledDerivedDirAbs());
  const fromBundled = readJsonSafe(bundled);
  if (fromBundled) return normalizeDoc(fromBundled);

  return normalizeDoc({ rows: [] });
}

export function writeSweepEffective(rows: SweepRow[]) {
  const out: SweepDoc = {
    ok: true,
    kind: "address_sweep_effective",
    version: "v1",
    rows,
    counts: computeCounts(rows),
    updatedAt: nowIso(),
  };
  const outAbs = effectiveAbsFrom(writableDerivedDirAbs());
  writeJson(outAbs, out);
  return out;
}

export function writeSweepCandidates(rows: SweepRow[]) {
  const out = {
    ok: true as const,
    kind: "address_sweep_candidates" as const,
    version: "v1" as const,
    counts: computeCounts(rows),
    rows,
    updatedAt: nowIso(),
  };
  const outAbs = candidatesAbsFrom(writableDerivedDirAbs());
  writeJson(outAbs, out);
  return out;
}

export function runSweep(limit: number) {
  const current = readSweepEffective();
  const boundedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, Math.floor(limit))) : 50;
  const rows = current.rows.slice(0, boundedLimit);
  const candidates = writeSweepCandidates(rows);
  const effective = writeSweepEffective(rows);
  return {
    ok: true as const,
    limit: boundedLimit,
    counts: effective.counts,
    candidatesUpdatedAt: candidates.updatedAt,
    updatedAt: effective.updatedAt,
  };
}

export function decideSweep(addressKey: string, decision: string, candidate?: any) {
  const doc = readSweepEffective();
  const rows = [...doc.rows];
  const idx = rows.findIndex((r) => String(r?.addressKey || "").trim() === addressKey);

  if (idx < 0) {
    rows.push({
      addressKey,
      addressClass: "unknown",
      reasons: ["manually_added"],
      sweepCandidates: [],
      adjudication: { decision, decidedAt: nowIso(), candidate },
    });
  } else {
    const row = rows[idx];
    rows[idx] = {
      ...row,
      adjudication: { decision, decidedAt: nowIso(), candidate },
    };
  }

  return writeSweepEffective(rows);
}
