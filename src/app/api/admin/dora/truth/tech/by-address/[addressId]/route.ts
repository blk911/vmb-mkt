import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { doraDenverTechIndexAbs } from "@/backend/lib/paths/data-root";

export async function GET(_: Request, { params }: { params: Promise<{ addressId: string }> | { addressId: string } }) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const addressId = String(resolvedParams.addressId || "").trim();

    if (!addressId) {
      return NextResponse.json({ ok: false, error: "missing addressId" }, { status: 400 });
    }

    const techDir = doraDenverTechIndexAbs();
    const byAddressDir = path.join(techDir, "by_address");
    const addrFile = path.join(byAddressDir, `${addressId}.json`);

    const addrJson = JSON.parse(await fs.readFile(addrFile, "utf8"));
    return NextResponse.json({ ok: true, addressId, techs: addrJson.techs || [] });
  } catch (e: any) {
    return NextResponse.json({ ok: true, addressId, techs: [] }); // Return empty if file doesn't exist
  }
}
