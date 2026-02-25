import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// repo root = .../scripts/node -> go up 2
const repoRoot = path.resolve(__dirname, "..", "..");

const sourceDir = path.join(repoRoot, "data", "co", "dora", "denver_metro", "source");
const outDir = path.join(repoRoot, "data", "co", "dora", "denver_metro", "tables");

const materializer = path.join(repoRoot, "scripts", "materialize", "vmb-materialize.js");

console.log("== VMB materialize ==");
console.log("repoRoot :", repoRoot);
console.log("sourceDir:", sourceDir);
console.log("outDir   :", outDir);
console.log("tool     :", materializer);

const r = spawnSync(process.execPath, [materializer, "--sourceDir", sourceDir, "--outDir", outDir], {
  stdio: "inherit",
  cwd: repoRoot
});

process.exit(r.status ?? 1);
