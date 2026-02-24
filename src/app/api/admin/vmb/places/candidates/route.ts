import { NextResponse } from "next/server";

import { adminDb } from "@/lib/admin/firestoreAdmin";
import { PLACES_CANDIDATES_COL } from "@/lib/places/storePaths";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = adminDb();
    const snap = await db.collection(PLACES_CANDIDATES_COL).limit(200).get();

    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ ok: true, rows, count: rows.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unknown_error" }, { status: 500 });
  }
}
