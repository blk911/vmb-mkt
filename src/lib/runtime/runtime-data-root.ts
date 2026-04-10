import fs from "node:fs";
import path from "node:path";

export function getRuntimeDataRoot(): string {
  const root = process.env.VERCEL
    ? path.join("/tmp", "vmb-mkt-runtime-data")
    : path.join(process.cwd(), "runtime-data");

  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}
