import { NextResponse } from "next/server";

import { adminDb } from "@/lib/admin/firestoreAdmin";
import { PLACES_CANDIDATES_COL, PLACES_RUNS_COL } from "@/lib/places/storePaths";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Use POST to run sweep",
  });
}

export async function POST() {
  try {
    const db = adminDb();

    // Minimal smoke-test write so rows are visible immediately.
    const runRef = await db.collection(PLACES_RUNS_COL).add({
      startedAt: Date.now(),
      status: "ok",
      note: "sweep smoke test write",
    });

    await db.collection(PLACES_CANDIDATES_COL).add({
      createdAt: Date.now(),
      placeName: "SMOKE TEST PLACE",
      types: ["storefront"],
      matchScore: 999,
      runId: runRef.id,
    });

    return NextResponse.json({ ok: true, runId: runRef.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unknown_error" }, { status: 500 });
  }
}
