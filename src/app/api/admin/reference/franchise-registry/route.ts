import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function GET() {
  try {
    const repoRoot = process.cwd();
    const registryPath = path.join(repoRoot, "backend", "data", "reference", "franchise_registry.json");

    if (!fs.existsSync(registryPath)) {
      return NextResponse.json(
        { ok: false, error: "franchise registry not found", path: registryPath },
        { status: 404 }
      );
    }

    const txt = fs.readFileSync(registryPath, "utf8");
    const registry = JSON.parse(txt);

    return NextResponse.json(registry, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "server error" },
      { status: 500 }
    );
  }
}
