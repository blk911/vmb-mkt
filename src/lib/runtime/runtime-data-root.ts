import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function getRuntimeDataRoot(): string {
  const explicit = process.env.VMB_RUNTIME_DATA_ROOT?.trim();
  const candidates = [
    explicit,
    process.env.VERCEL ? path.join("/tmp", "vmb-mkt-runtime-data") : path.join(process.cwd(), "runtime-data"),
    path.join(os.tmpdir(), "vmb-mkt-runtime-data"),
  ].filter(Boolean) as string[];

  for (const root of candidates) {
    try {
      if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
      fs.accessSync(root, fs.constants.W_OK);
      return root;
    } catch {
      // Try the next writable runtime-data candidate.
    }
  }

  return path.join(os.tmpdir(), "vmb-mkt-runtime-data");
}
