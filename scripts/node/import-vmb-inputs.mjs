import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, exists, vmbTablesDir, die } from "./_paths.mjs";

const NEED = ["vmb_facilities.json", "vmb_licensees.json"];

function parseArg(name) {
  const i = process.argv.indexOf(name);
  if (i === -1) return null;
  return process.argv[i + 1] || null;
}

async function main() {
  const source = parseArg("--source") || parseArg("-s");
  if (!source) die("Usage: npm run import:vmb -- --source \"C:\\path\\to\\folder\"");

  if (!(await exists(source))) die(`SourceDir not found: ${source}`);

  const dstDir = vmbTablesDir();
  await ensureDir(dstDir);

  for (const f of NEED) {
    const src = path.join(source, f);
    if (!(await exists(src))) die(`Missing in SourceDir: ${src}`);
  }

  for (const f of NEED) {
    const src = path.join(source, f);
    const dst = path.join(dstDir, f);
    await fs.copyFile(src, dst);
    const st = await fs.stat(dst);
    console.log(`COPIED: ${f}  (${st.size} bytes)`);
  }

  console.log(`OK. Inputs are now in: ${dstDir}`);
  console.log("Next: npm run materialize:vmb");
}

main().catch((e) => die(e?.message || String(e)));
