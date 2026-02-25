import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const runtime = "nodejs";

const LOCK_REL = "data/co/dora/denver_metro/.locks/apply_place_merge.lock";

function lockPath() {
  return path.resolve(process.cwd(), LOCK_REL);
}

function ensureLockDir() {
  fs.mkdirSync(path.dirname(lockPath()), { recursive: true });
}

export async function POST() {
  ensureLockDir();

  // naive lock (good enough for local single host)
  if (fs.existsSync(lockPath())) {
    return Response.json(
      { ok: false, error: "Merge already running (lock present). Try again in a moment." },
      { status: 409 }
    );
  }

  fs.writeFileSync(lockPath(), String(Date.now()), "utf8");

  try {
    // Runs the same command you run manually
    const r = spawnSync("npm", ["run", "merge:facilities:place"], {
      cwd: process.cwd(),
      encoding: "utf8",
      shell: true,
    });

    const ok = r.status === 0;

    return Response.json(
      {
        ok,
        status: r.status,
        stdout: (r.stdout ?? "").slice(-4000), // keep response small
        stderr: (r.stderr ?? "").slice(-4000),
      },
      { status: ok ? 200 : 500 }
    );
  } finally {
    try {
      fs.unlinkSync(lockPath());
    } catch {}
  }
}
