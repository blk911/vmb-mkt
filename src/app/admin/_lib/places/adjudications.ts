import fs from "fs";
import path from "path";
import { dataRootAbs } from "../../../api/admin/_lib/paths";

export type PlaceDecision = "accepted" | "rejected" | "defer";

export type Adjudication = {
  addressKey: string;
  decision: PlaceDecision;
  note?: string;
  decidedAt: string;
};

type AdjudicationsDoc = {
  ok: true;
  kind: "places_adjudications";
  version: "v1";
  updatedAt: string;
  items: Adjudication[];
};

function nowIso() {
  return new Date().toISOString();
}

function adjudicationsAbs() {
  return path.join(
    dataRootAbs(),
    "co",
    "dora",
    "denver_metro",
    "places",
    "derived",
    "places_adjudications.v1.json"
  );
}

export function readAdjudications(): AdjudicationsDoc {
  const abs = adjudicationsAbs();
  if (!fs.existsSync(abs)) {
    return {
      ok: true,
      kind: "places_adjudications",
      version: "v1",
      updatedAt: nowIso(),
      items: [],
    };
  }
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

export function upsertAdjudication(a: Adjudication) {
  const abs = adjudicationsAbs();
  const doc = readAdjudications();
  const items = Array.isArray(doc.items) ? doc.items : [];

  const idx = items.findIndex((x) => x.addressKey === a.addressKey);
  if (idx >= 0) items[idx] = a;
  else items.push(a);

  const next: AdjudicationsDoc = {
    ok: true,
    kind: "places_adjudications",
    version: "v1",
    updatedAt: nowIso(),
    items,
  };

  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export function indexAdjudicationsByAddressKey(doc: AdjudicationsDoc) {
  const m = new Map<string, Adjudication>();
  for (const a of doc.items || []) {
    if (a?.addressKey) m.set(a.addressKey, a);
  }
  return m;
}
