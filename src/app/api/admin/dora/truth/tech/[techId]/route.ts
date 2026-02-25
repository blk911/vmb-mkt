import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { doraDenverTechIndexAbs } from "@/backend/lib/paths/data-root";

export async function GET(_: Request, { params }: { params: Promise<{ techId: string }> | { techId: string } }) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const techId = String(resolvedParams.techId || "").trim();

    if (!techId) {
      return NextResponse.json({ ok: false, error: "missing techId" }, { status: 400 });
    }

    const techDir = doraDenverTechIndexAbs();
    const byLicenseDir = path.join(techDir, "by_license");
    const techFile = path.join(byLicenseDir, `${techId}.json`);

    const techJson = JSON.parse(await fs.readFile(techFile, "utf8"));
    return NextResponse.json({ ok: true, tech: techJson.tech });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 404 });
  }
}
