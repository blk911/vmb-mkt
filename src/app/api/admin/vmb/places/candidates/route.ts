import { NextResponse } from "next/server";

import { adminDb } from "@/lib/admin/firestoreAdmin";
import { PLACES_CANDIDATES_COL } from "@/lib/places/storePaths";

export async function GET() {
  const db = adminDb();
  const snap = await db.collection(PLACES_CANDIDATES_COL).limit(200).get();

  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ rows, count: rows.length });
}
