import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

function readJson(rel: string) {
  const abs = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(abs)) {
    return { ok: false, error: `Missing file: ${rel}`, rows: [] };
  }
  const raw = fs.readFileSync(abs, "utf8");
  return JSON.parse(raw);
}

export async function GET() {
  const rel = "data/co/dora/denver_metro/tables/vmb_facilities_enriched.json";
  const data = readJson(rel);

  // Normalize response shape for UI
  const rows = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
  const updatedAt = data?.updatedAt ?? null;
  const counts = data?.counts ?? { facilities: rows.length };

  return Response.json({
    ok: true,
    source: rel,
    updatedAt,
    counts,
    rows,
  });
}
