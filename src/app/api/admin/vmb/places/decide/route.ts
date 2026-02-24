import { NextResponse } from "next/server";

import { adminDb } from "@/lib/admin/firestoreAdmin";
import { PLACES_CANDIDATES_COL } from "@/lib/places/storePaths";

type DecideBody = {
  id: string;
  decision: "approve" | "reject" | "skip";
  note?: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<DecideBody>;

  if (!body?.id || !body?.decision) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields: id, decision" },
      { status: 400 }
    );
  }

  const db = adminDb();
  const ref = db.collection(PLACES_CANDIDATES_COL).doc(body.id);

  // Ensure doc exists (helps debugging)
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ ok: false, error: `Candidate not found: ${body.id}` }, { status: 404 });
  }

  await ref.set(
    {
      decision: body.decision,
      decisionNote: body.note ?? "",
      decidedAt: Date.now(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true, id: body.id, decision: body.decision });
}
