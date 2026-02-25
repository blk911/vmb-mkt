import { NextResponse } from "next/server";
import fs from "fs";

const PATH = "data/co/dora/denver_metro/places/derived/tech_index.v4_facilities.v1.json";

function pickLite(t: any) {
  return {
    id: t.id,
    addressKey: t.addressKey,
    displayName: t.displayName,
    address: t.address,
    techSignals: t.techSignals,
    segment: t.segment,
    segmentConfidence: t.segmentConfidence,
    segmentSignals: t.segmentSignals,
    rosterSummary: t.rosterSummary,
    rosterJoin: t.rosterJoin,
    rosterNames: t.rosterNames ? { topNames: t.rosterNames.topNames } : undefined,
    rosterLicenseTypes: t.rosterLicenseTypes,
    premise: t.premise
      ? {
          types: t.premise.types,
          phone: t.premise.phone,
          website: t.premise.website,
          matchScore: t.premise.matchScore,
          center: t.premise.center,
        }
      : undefined,
    places: t.places ? { best: t.places.best } : undefined,
    tags: t.tags,
    updatedAt: t.updatedAt,
  };
}

export async function GET(req: Request) {
  if (!fs.existsSync(PATH)) {
    return NextResponse.json(
      { ok: false, error: "missing_tech_index", path: PATH },
      { status: 404 }
    );
  }

  const url = new URL(req.url);
  const lite = url.searchParams.get("lite") === "1";
  const id = (url.searchParams.get("id") || "").trim();

  const text = fs.readFileSync(PATH, "utf8");
  const json = JSON.parse(text);

  // If requesting a single tech entity by id
  if (id) {
    const tech = (json.tech || []) as any[];
    const hit = tech.find((t) => t.id === id) || null;
    if (!hit) {
      return NextResponse.json({ ok: false, error: "not_found", id }, { status: 404 });
    }
    return NextResponse.json(lite ? pickLite(hit) : hit, { status: 200 });
  }

  // Default: return the whole index
  if (lite) {
    return NextResponse.json(
      {
        ok: json.ok,
        kind: json.kind,
        version: json.version,
        counts: json.counts,
        source: json.source,
        updatedAt: json.updatedAt,
        tech: (json.tech || []).map(pickLite),
      },
      { status: 200 }
    );
  }

  return NextResponse.json(json, { status: 200 });
}
