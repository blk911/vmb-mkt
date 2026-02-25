import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { doraDenverTargetIndexAbs, doraDenverTargetListsDirAbs } from "@/backend/lib/paths/targets";

async function writeJsonAtomic(abs: string, obj: any) {
  await fs.mkdir(path.dirname(abs), { recursive: true });
  const tmp = abs + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2), "utf8");
  await fs.rename(tmp, abs);
}

async function readJsonIfExists(abs: string) {
  try {
    return JSON.parse(await fs.readFile(abs, "utf8"));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });

    const { name, meta, selections } = body;
    if (!name || !selections) {
      return NextResponse.json({ ok: false, error: "missing name or selections" }, { status: 400 });
    }

    const targetId = `t_${crypto.randomBytes(6).toString("hex")}`;
    const now = new Date().toISOString();

    const payload = {
      ok: true,
      targetId,
      name,
      createdAt: now,
      meta: meta || {},
      selections, // { addresses:[], techs:[] }
    };

    const listsDir = doraDenverTargetListsDirAbs();
    const indexAbs = doraDenverTargetIndexAbs();

    await fs.mkdir(listsDir, { recursive: true });

    const listAbs = path.join(listsDir, `${targetId}.json`);
    await writeJsonAtomic(listAbs, payload);

    const index = (await readJsonIfExists(indexAbs)) || { ok: true, updatedAt: now, lists: [] };
    index.lists = Array.isArray(index.lists) ? index.lists : [];
    index.lists.unshift({
      targetId,
      name,
      createdAt: now,
      counts: {
        addresses: selections.addresses?.length || 0,
        techs: selections.techs?.length || 0,
      },
      meta: meta || {},
    });
    index.updatedAt = now;

    await writeJsonAtomic(indexAbs, index);

    return NextResponse.json({ ok: true, targetId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
