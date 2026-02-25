import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { doraDenverTargetIndexAbs } from "@/backend/lib/paths/targets";

export async function GET() {
  try {
    const s = await fs.readFile(doraDenverTargetIndexAbs(), "utf8");
    return new NextResponse(s, { headers: { "content-type": "application/json", "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: true, lists: [] });
  }
}
