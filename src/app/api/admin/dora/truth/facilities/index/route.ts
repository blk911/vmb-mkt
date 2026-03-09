import fs from "node:fs";
import path from "node:path";
import { dataRootAbs } from "@/backend/lib/paths/data-root";

export const runtime = "nodejs";

function readJson(abs: string) {
  if (!fs.existsSync(abs)) {
    return { ok: false, error: `Missing file: ${abs}`, rows: [] };
  }
  const raw = fs.readFileSync(abs, "utf8");
  return JSON.parse(raw);
}

export async function GET() {
  const rel = path.join("co", "dora", "denver_metro", "tables", "vmb_facilities_enriched.json");
  const abs = path.join(dataRootAbs(), rel);
  const data = readJson(abs);

  // Normalize response shape for UI
  const rows = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
  const updatedAt = data?.updatedAt ?? null;
  const counts = data?.counts ?? { facilities: rows.length };

  return Response.json({
    ok: true,
    source: abs,
    updatedAt,
    counts,
    rows,
  });
}
