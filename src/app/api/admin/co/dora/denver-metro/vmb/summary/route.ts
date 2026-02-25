import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    counts: { total: 0, attached: 0, candidates: 0 },
  });
}
