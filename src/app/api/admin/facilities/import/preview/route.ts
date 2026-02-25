import { NextResponse } from "next/server";
import { parseSmart } from "../../../../../admin/_lib/facilities/parse";
import { previewFacilities } from "../../../../../admin/_lib/facilities/match";
import { brandDefaultSeedFile, normSpace } from "../../../../../admin/_lib/facilities/normalize";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const format = normSpace(body?.format || "jsonl").toLowerCase();
    const text = String(body?.text ?? "");
    const defaults = body?.defaults ?? {};

    const parsed = parseSmart(text, format === "csv" ? "csv" : "jsonl", {
      brand: normSpace(defaults.brand || ""),
      category: normSpace(defaults.category || ""),
      source: normSpace(defaults.source || "operator_import"),
    });

    // apply defaults (brand/category/source) when missing
    const rows = parsed.map((r) => ({
      ...r,
      brand: normSpace(r.brand || defaults.brand || ""),
      category: normSpace(r.category || defaults.category || ""),
      source: normSpace(r.source || defaults.source || "operator_import"),
    }));

    const preview = previewFacilities(rows);

    // suggest a seed file name
    const suggestedSeedFile =
      normSpace(body?.seedFileName) ||
      brandDefaultSeedFile(defaults.brand || rows[0]?.brand || "facilities");

    return NextResponse.json({
      ok: true,
      format,
      suggestedSeedFile,
      ...preview,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "preview_failed" },
      { status: 500 }
    );
  }
}
