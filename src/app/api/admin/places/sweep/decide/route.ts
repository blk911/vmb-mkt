import { decideSweep } from "../../../../../admin/_lib/places/sweep/store";

const ALLOWED_DECISIONS = new Set([
  "confirm_candidate",
  "suite_center",
  "residential",
  "unknown",
  "no_storefront",
]);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const addressKey = String(body?.addressKey || "").trim();
    const decision = String(body?.decision || "").trim();
    const candidate = body?.candidate;

    if (!addressKey) {
      return Response.json({ ok: false, error: "Missing addressKey" }, { status: 400 });
    }
    if (!ALLOWED_DECISIONS.has(decision)) {
      return Response.json({ ok: false, error: "Invalid decision" }, { status: 400 });
    }

    const out = decideSweep(addressKey, decision, candidate);
    return Response.json({ ok: true, counts: out.counts, updatedAt: out.updatedAt });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "unknown_error" }, { status: 500 });
  }
}
