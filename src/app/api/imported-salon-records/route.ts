import { NextResponse } from "next/server";
import { readImportedSalonRecords } from "@/lib/imported-salon-records/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const records = await readImportedSalonRecords();
    return NextResponse.json(
      { ok: true as const, records },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
