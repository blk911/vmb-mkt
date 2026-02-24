import { runSweep } from "../../../../../admin/_lib/places/sweep/store";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Number(body?.limit ?? 50);
    const out = runSweep(limit);
    return Response.json(out);
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "unknown_error" }, { status: 500 });
  }
}
