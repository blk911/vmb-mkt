import fs from "fs";
import path from "path";

export function getWritableDataRoot() {
  // Vercel serverless: writable temp dir
  const isVercel = !!process.env.VERCEL;
  const root = isVercel ? path.join("/tmp", "vmb-mkt-data") : path.join(process.cwd(), "data");

  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}
