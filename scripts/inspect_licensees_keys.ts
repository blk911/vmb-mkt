import fs from "node:fs";
import path from "node:path";

const FILE = "data/co/dora/denver_metro/tables/vmb_licensees_attached.json";
const abs = path.resolve(process.cwd(), FILE);
if (!fs.existsSync(abs)) throw new Error(`Missing ${FILE}`);

const raw = fs.readFileSync(abs, "utf8");
const j = JSON.parse(raw);

const rows = Array.isArray(j?.rows) ? j.rows : Array.isArray(j) ? j : [];
if (!rows.length) {
  console.log("No rows found.");
  process.exit(0);
}

const keys = Object.keys(rows[0]).sort();
console.log("rows:", rows.length);
console.log("keys (row[0]):");
for (const k of keys) console.log(" -", k);

// also show a sample row (trimmed)
console.log("\nSample row[0] (selected fields):");
const sample: any = {};
for (const k of keys.slice(0, 30)) sample[k] = rows[0][k];
console.log(sample);
