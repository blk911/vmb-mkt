import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { dataRootAbs } from "../../_lib/paths";
import {
  readAdjudications,
  indexAdjudicationsByAddressKey,
} from "../../../../admin/_lib/places/adjudications";

const SRC_REL = "data/co/dora/denver_metro/places/derived/places_matched_facilities.v1.json";

export async function GET() {
  const abs = path.join(
    dataRootAbs(),
    "co",
    "dora",
    "denver_metro",
    "places",
    "derived",
    "places_matched_facilities.v1.json"
  );
  if (!fs.existsSync(abs)) {
    return NextResponse.json({ ok: false, error: `Missing ${SRC_REL}` }, { status: 404 });
  }

  const doc: any = JSON.parse(fs.readFileSync(abs, "utf8"));
  const rows: any[] = Array.isArray(doc?.rows) ? doc.rows : [];

  const adjDoc = readAdjudications();
  const byAk = indexAdjudicationsByAddressKey(adjDoc);

  const merged = rows.map((r) => {
    const ak = String(r?.addressKey || "").trim();
    const a = ak ? byAk.get(ak) : null;
    return { ...r, adjudication: a ?? { addressKey: ak, decision: "unreviewed" } };
  });

  return NextResponse.json({
    ok: true,
    kind: "places_review",
    version: "v1",
    counts: {
      rows: merged.length,
      unreviewed: merged.filter((x) => x.adjudication?.decision === "unreviewed").length,
      accepted: merged.filter((x) => x.adjudication?.decision === "accepted").length,
      rejected: merged.filter((x) => x.adjudication?.decision === "rejected").length,
      defer: merged.filter((x) => x.adjudication?.decision === "defer").length,
    },
    rows: merged,
    updatedAt: new Date().toISOString(),
  });
}
