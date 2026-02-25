import fs from "node:fs";
import path from "node:path";
import type { SweepAdjudication } from "./types";
import { sweepAdjudicationsAbs } from "./paths";

type SweepAdjudicationsDoc = {
  ok: true;
  kind: "address_sweep_adjudications";
  version: "v1";
  updatedAt: string;
  items: SweepAdjudication[];
};

function nowIso() {
  return new Date().toISOString();
}

export function readSweepAdjudications(): SweepAdjudicationsDoc {
  const abs = sweepAdjudicationsAbs();
  if (!fs.existsSync(abs)) {
    return {
      ok: true,
      kind: "address_sweep_adjudications",
      version: "v1",
      updatedAt: nowIso(),
      items: [],
    };
  }
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

export function upsertSweepAdjudication(item: SweepAdjudication) {
  const abs = sweepAdjudicationsAbs();
  const doc = readSweepAdjudications();
  const items = Array.isArray(doc?.items) ? doc.items : [];
  const idx = items.findIndex((x) => x.addressKey === item.addressKey);
  if (idx >= 0) items[idx] = item;
  else items.push(item);

  const next: SweepAdjudicationsDoc = {
    ok: true,
    kind: "address_sweep_adjudications",
    version: "v1",
    updatedAt: nowIso(),
    items,
  };

  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function upsertSweepAdjudicationMany(
  items: Array<{ addressKey: string; decision: "rejected"; reason?: string; updatedAt: string }>
) {
  const abs = sweepAdjudicationsAbs();
  const doc = readSweepAdjudications();
  const rows = Array.isArray(doc?.items) ? [...doc.items] : [];
  const byAk = new Map<string, number>();
  rows.forEach((x, i) => {
    const ak = String(x?.addressKey || "").trim();
    if (ak) byAk.set(ak, i);
  });

  let changed = 0;
  for (const it of items) {
    const ak = String(it?.addressKey || "").trim();
    if (!ak) continue;
    const next: SweepAdjudication = {
      addressKey: ak,
      decision: "rejected",
      note: it.reason || undefined,
      decidedAt: it.updatedAt || new Date().toISOString(),
    };
    const idx = byAk.get(ak);
    if (idx != null) {
      const prev = rows[idx];
      const same = prev?.decision === next.decision && (prev?.note || "") === (next.note || "");
      if (!same) {
        rows[idx] = next;
        changed += 1;
      }
    } else {
      rows.push(next);
      byAk.set(ak, rows.length - 1);
      changed += 1;
    }
  }

  const out = {
    ok: true as const,
    kind: "address_sweep_adjudications" as const,
    version: "v1" as const,
    updatedAt: new Date().toISOString(),
    items: rows,
  };
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(out, null, 2), "utf8");
  return changed;
}

export function indexSweepAdjudicationsByAddressKey(doc: SweepAdjudicationsDoc) {
  const m = new Map<string, SweepAdjudication>();
  for (const it of doc?.items || []) {
    if (it?.addressKey) m.set(it.addressKey, it);
  }
  return m;
}
