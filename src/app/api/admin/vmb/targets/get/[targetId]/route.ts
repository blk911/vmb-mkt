import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { doraDenverTargetListsDirAbs } from "@/backend/lib/paths/targets";

export async function GET(_: Request, { params }: { params: Promise<{ targetId: string }> | { targetId: string } }) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const targetId = decodeURIComponent(resolvedParams.targetId || "").trim();
    if (!targetId) {
      return NextResponse.json({ ok: false, error: "missing targetId" }, { status: 400 });
    }

    const abs = path.join(doraDenverTargetListsDirAbs(), `${targetId}.json`);
    const s = await fs.readFile(abs, "utf8");
    return new NextResponse(s, { headers: { "content-type": "application/json", "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 404 });
  }
}
