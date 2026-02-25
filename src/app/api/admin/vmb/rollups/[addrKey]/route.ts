import { NextResponse } from "next/server";
import fs from "node:fs";
import { resolveDoraTableAbs } from "@/backend/lib/paths/data-root";

type RollupRow = any;

function safeReadJson(absPath: string) {
  const txt = fs.readFileSync(absPath, "utf8");
  return JSON.parse(txt);
}

/**
 * Small in-memory cache so we don't re-parse 100MB JSON files on every click in dev.
 * Cache invalidates when mtime changes.
 */
const g: any = globalThis as any;
g.__vmbCache = g.__vmbCache || {
  rollups: { abs: "", mtimeMs: 0, data: null as null | RollupRow[] },
  attached: { abs: "", mtimeMs: 0, data: null as null | any[] },
  candidates: { abs: "", mtimeMs: 0, data: null as null | any[] },
};

function readCached(key: "rollups" | "attached" | "candidates", abs: string) {
  const st = fs.statSync(abs);
  const cache = g.__vmbCache[key];
  if (cache.abs !== abs || cache.mtimeMs !== st.mtimeMs || !cache.data) {
    cache.abs = abs;
    cache.mtimeMs = st.mtimeMs;
    cache.data = safeReadJson(abs);
  }
  return cache.data;
}

export async function GET(
  _req: Request,
  ctx: { params: { addrKey: string } }
) {
  try {
    const addrKey = decodeURIComponent(ctx.params.addrKey || "").trim();
    if (!addrKey) {
      return NextResponse.json(
        { ok: false, error: "missing addrKey" },
        { status: 400 }
      );
    }

    // Use canonical resolver for all table files
    const path = await import("node:path");
    const rollupsAbs = process.env.VMB_ROLLUPS_JSON_REL?.trim()
      ? path.isAbsolute(process.env.VMB_ROLLUPS_JSON_REL.trim())
        ? process.env.VMB_ROLLUPS_JSON_REL.trim()
        : path.join(process.cwd(), process.env.VMB_ROLLUPS_JSON_REL.trim())
      : resolveDoraTableAbs("address_rollup");

    // Try both naming conventions for attached/candidates
    let attachedAbs: string | null = null;
    let candidatesAbs: string | null = null;
    try {
      attachedAbs = resolveDoraTableAbs("licensees_attached");
    } catch {}
    try {
      candidatesAbs = resolveDoraTableAbs("attach_candidates");
    } catch {}

    if (!fs.existsSync(rollupsAbs)) {
      return NextResponse.json(
        { ok: false, error: "rollups json not found", rollupsAbs },
        { status: 404 }
      );
    }

    const rollups = readCached("rollups", rollupsAbs) as RollupRow[];
    const row =
      rollups.find((r) => String(r.addressKey || r.rollupKey) === addrKey) ||
      null;

    // Attached techs/candidates are optional; if missing, return empty arrays.
    let techs: any[] = [];
    let candidates: any[] = [];

    if (fs.existsSync(attachedAbs)) {
      const attached = readCached("attached", attachedAbs) as any[];
      techs = attached
        .filter((t) => String(t.addressKey) === addrKey)
        .slice(0, 200);
    }

    if (fs.existsSync(candidatesAbs)) {
      const cand = readCached("candidates", candidatesAbs) as any[];
      candidates = cand
        .filter((t) => String(t.addressKey) === addrKey)
        .slice(0, 200);
    }

    return NextResponse.json(
      {
        ok: true,
        addrKey,
        rollupsAbs,
        row,
        sample: {
          techs: techs.length,
          candidates: candidates.length,
        },
        techs,
        candidates,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "server error" },
      { status: 500 }
    );
  }
}
