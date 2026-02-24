import { readSweepEffective } from "../../../../admin/_lib/places/sweep/store";

export async function GET() {
  try {
    const doc = readSweepEffective();
    return Response.json({
      ok: true,
      counts: doc.counts,
      rows: doc.rows,
      updatedAt: doc.updatedAt,
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "unknown_error" }, { status: 500 });
  }
}
