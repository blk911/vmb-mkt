import fs from "node:fs/promises";
import path from "node:path";
import { exists } from "./_paths.mjs";

const WANT = ["vmb_facilities.json", "vmb_licensees.json"];

async function walk(dir, maxFiles = 250000) {
  const hits = [];
  let seen = 0;

  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let items;
    try {
      items = await fs.readdir(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const it of items) {
      if (++seen > maxFiles) return hits;
      const full = path.join(cur, it.name);
      if (it.isDirectory()) {
        const name = it.name.toLowerCase();
        if (name === "node_modules" || name === ".git" || name === ".next") continue;
        stack.push(full);
      } else {
        if (WANT.includes(it.name)) hits.push(full);
      }
    }
  }
  return hits;
}

function groupByDir(paths) {
  const m = new Map();
  for (const p of paths) {
    const d = path.dirname(p);
    if (!m.has(d)) m.set(d, []);
    m.get(d).push(p);
  }
  return m;
}

async function main() {
  const args = process.argv.slice(2);
  const root = args.includes("--root")
    ? "C:\\"
    : "C:\\dev";

  console.log(`== find:vmb scanning: ${root} ==`);
  if (!(await exists(root))) {
    console.log(`Root not found: ${root}`);
    process.exit(2);
  }

  const hits = await walk(root);
  if (!hits.length) {
    console.log("NOT FOUND: vmb_facilities.json / vmb_licensees.json");
    console.log("Try the full disk scan:");
    console.log("  npm run find:vmb -- --root");
    process.exit(1);
  }

  const byDir = groupByDir(hits);
  const candidates = [];
  for (const [dir, files] of byDir.entries()) {
    const names = files.map((f) => path.basename(f));
    const hasAll = WANT.every((n) => names.includes(n));
    candidates.push({ dir, hasAll, files: names });
  }

  candidates.sort((a, b) => Number(b.hasAll) - Number(a.hasAll));

  console.log("FOUND candidate directories:");
  for (const c of candidates.slice(0, 20)) {
    console.log(`- ${c.dir}  ${c.hasAll ? "[OK: has both]" : "[partial]"}  files=${c.files.join(", ")}`);
  }

  const best = candidates.find((c) => c.hasAll);
  if (best) {
    console.log("");
    console.log("BEST SourceDir (copy/paste):");
    console.log(best.dir);
    process.exit(0);
  }

  console.log("");
  console.log("No single directory contains BOTH files. You must locate/restore them.");
  process.exit(1);
}

main().catch((e) => {
  console.error("find:vmb failed:", e?.message || e);
  process.exit(1);
});
