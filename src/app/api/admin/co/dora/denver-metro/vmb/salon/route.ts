import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    regLicenseNumber: null,
    attached: { total: 0, rows: [] },
    candidates: { total: 0, rows: [] },
  });
}
