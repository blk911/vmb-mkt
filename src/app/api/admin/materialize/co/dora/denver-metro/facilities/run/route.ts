import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";

type AnyObj = Record<string, any>;

function s(v: any) {
  return String(v ?? "").trim();
}
function up(v: any) {
  return s(v).toUpperCase();
}

function mkdirp(absDir: string) {
  fssync.mkdirSync(absDir, { recursive: true });
}
function writeAtomicJson(abs: string, obj: any) {
  mkdirp(path.dirname(abs));
  const tmp = abs + ".tmp";
  fssync.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  fssync.renameSync(tmp, abs);
}

function firstExisting(pathsAbs: string[]) {
  for (const p of pathsAbs) if (fssync.existsSync(p)) return p;
  return null;
}

export async function POST(req: Request) {
  try {
    const repo = process.cwd();
    const tablesDir = path.join(repo, "data", "co", "dora", "denver_metro", "tables");

    const candidates = [
      path.join(tablesDir, "vmb_licensees_attached.json"),
      path.join(repo, "backend", "data", "co", "dora", "denver_metro", "tables", "vmb_licensees_attached.json"),
    ];

    const attachedAbs = firstExisting(candidates);
    if (!attachedAbs) {
      return NextResponse.json(
        { ok: false, error: "missing vmb_licensees_attached.json", tried: candidates },
        { status: 400 }
      );
    }

    const updatedAt = new Date().toISOString();

    const raw = JSON.parse(await fs.readFile(attachedAbs, "utf8"));
    const rows: AnyObj[] = Array.isArray(raw?.rows) ? raw.rows : Array.isArray(raw) ? raw : [];

    // Roll up "facilities" by rollupKey
    const byKey = new Map<string, AnyObj>();

    for (const r of rows) {
      const rollupKey = up(r.homeRollupKey || r.areaKey || r.primaryRollupKey);
      if (!rollupKey) continue;

      let o = byKey.get(rollupKey);
      if (!o) {
        o = {
          rollupKey,
          state: up(r.state),
          city: up(r.city),
          zip: s(r.zip),
          name: s(r.salonName || r.facilityName || r.businessName || ""),
          techCount: 0,
          _addressSet: new Set<string>(),
          sampleTechIds: [] as string[],
        };
        byKey.set(rollupKey, o);
      }

      o.techCount += 1;

      const addr = up(`${s(r.address1)}|${s(r.city)}|${s(r.state)}|${s(r.zip)}`);
      if (addr && addr !== "|||") o._addressSet.add(addr);

      if (o.sampleTechIds.length < 5) {
        const tid = s(r.techId);
        if (tid) o.sampleTechIds.push(tid);
      }

      // backfill
      if (!o.name) o.name = s(r.salonName || r.facilityName || r.businessName || "");
      if (!o.city) o.city = up(r.city);
      if (!o.state) o.state = up(r.state);
      if (!o.zip) o.zip = s(r.zip);
    }

    const outRows = Array.from(byKey.values()).map((o) => {
      const addressCount = (o._addressSet as Set<string>).size;
      delete o._addressSet;
      return { ...o, addressCount };
    });

    outRows.sort((a, b) => String(a.rollupKey).localeCompare(String(b.rollupKey)));

    const outAbs = path.join(tablesDir, "vmb_facilities.json");
    writeAtomicJson(outAbs, {
      ok: true,
      updatedAt,
      source: path.basename(attachedAbs),
      rows: outRows,
    });

    return NextResponse.json({
      ok: true,
      rel: "data/co/dora/denver_metro/tables/vmb_facilities.json",
      updatedAt,
      counts: { facilities: outRows.length, licenseesRows: rows.length },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
