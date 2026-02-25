import fs from "fs";
import path from "path";
import { dataRootAbs } from "../../../api/admin/_lib/paths";
import { readAdjudications, indexAdjudicationsByAddressKey } from "./adjudications";

function nowIso() {
  return new Date().toISOString();
}

function matchedFacilitiesAbs() {
  return path.join(
    dataRootAbs(),
    "co",
    "dora",
    "denver_metro",
    "places",
    "derived",
    "places_matched_facilities.v1.json"
  );
}

function outEffectiveAbs() {
  return path.join(
    dataRootAbs(),
    "co",
    "dora",
    "denver_metro",
    "places",
    "derived",
    "places_matched_effective.v1.json"
  );
}

export function materializePlacesMatchedEffective() {
  const srcAbs = matchedFacilitiesAbs();
  if (!fs.existsSync(srcAbs)) throw new Error(`Missing ${srcAbs}`);

  const src: any = JSON.parse(fs.readFileSync(srcAbs, "utf8"));
  const rows: any[] = Array.isArray(src?.rows) ? src.rows : [];

  const adj = readAdjudications();
  const byAk = indexAdjudicationsByAddressKey(adj);

  let accepted = 0;
  let rejected = 0;
  let defer = 0;
  let unreviewed = 0;

  const outRows = rows.map((r) => {
    const ak = String(r?.addressKey || "").trim();
    const a = ak ? byAk.get(ak) : null;

    const decision = a?.decision ?? "unreviewed";
    if (decision === "accepted") accepted += 1;
    else if (decision === "rejected") rejected += 1;
    else if (decision === "defer") defer += 1;
    else unreviewed += 1;

    return { ...r, adjudication: a ?? { addressKey: ak, decision: "unreviewed" } };
  });

  const outDoc: any = {
    ok: true,
    kind: "places_matched_effective",
    version: "v1",
    source: {
      matched: "data/co/dora/denver_metro/places/derived/places_matched_facilities.v1.json",
      adjudications: "data/co/dora/denver_metro/places/derived/places_adjudications.v1.json",
    },
    counts: {
      rows: outRows.length,
      accepted,
      rejected,
      defer,
      unreviewed,
    },
    rows: outRows,
    updatedAt: nowIso(),
  };

  fs.mkdirSync(path.dirname(outEffectiveAbs()), { recursive: true });
  fs.writeFileSync(outEffectiveAbs(), JSON.stringify(outDoc, null, 2), "utf8");

  return { outAbs: outEffectiveAbs(), counts: outDoc.counts, updatedAt: outDoc.updatedAt };
}
