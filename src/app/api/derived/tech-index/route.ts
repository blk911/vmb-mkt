import { NextResponse } from "next/server";
import fs from "fs";
import { adminDb } from "@/lib/admin/firestoreAdmin";
import { TECH_INDEX_COL } from "@/lib/places/storePaths";

const PATH = "data/co/dora/denver_metro/places/derived/tech_index.v4_facilities.v1.json";
export const runtime = "nodejs";

function hasFirebaseEnv() {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}

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
  const url = new URL(req.url);
  const lite = url.searchParams.get("lite") === "1";
  const id = (url.searchParams.get("id") || "").trim();
  let tech: any[] = [];
  let source: any = null;
  let updatedAt = new Date().toISOString();
  let firestoreError: string | null = null;

  // Primary source: Firestore (durable for Vercel)
  if (hasFirebaseEnv()) {
    try {
      const db = adminDb();
      const snap = await db.collection(TECH_INDEX_COL).limit(5000).get();
      tech = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (tech.length > 0) {
        source = { provider: "firestore", collection: TECH_INDEX_COL, rows: tech.length };
      }
    } catch (e: any) {
      firestoreError = e?.message || "firestore_read_failed";
    }
  }

  // Fallback source: local file (dev convenience)
  if (!tech.length) {
    if (!fs.existsSync(PATH)) {
      return NextResponse.json(
        { ok: false, error: "missing_tech_index", path: PATH, firestoreError },
        { status: 404 }
      );
    }
    const text = fs.readFileSync(PATH, "utf8");
    const json = JSON.parse(text);
    tech = (json.tech || []) as any[];
    source = json.source || { provider: "file", path: PATH };
    updatedAt = json.updatedAt || updatedAt;
  }

  // If requesting a single tech entity by id
  if (id) {
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
        ok: true,
        kind: "tech_index",
        version: "v4_firestore",
        counts: { rows: tech.length },
        source,
        updatedAt,
        tech: tech.map(pickLite),
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      kind: "tech_index",
      version: "v4_firestore",
      counts: { rows: tech.length },
      source,
      updatedAt,
      tech,
    },
    { status: 200 }
  );
}
