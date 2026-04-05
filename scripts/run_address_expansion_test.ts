const path = require("node:path");
const Module = require("node:module");
const fs = require("node:fs");

const origResolve = Module._resolveFilename;
Module._resolveFilename = function patchedResolve(request: string, parent: unknown, isMain: boolean, options: unknown) {
  if (request.startsWith("@/")) {
    const raw = request.slice(2);
    const rootMapped = path.join(process.cwd(), raw);
    const srcMapped = path.join(process.cwd(), "src", raw);
    const pick = (candidate: string): boolean =>
      fs.existsSync(candidate) ||
      fs.existsSync(`${candidate}.ts`) ||
      fs.existsSync(`${candidate}.tsx`) ||
      fs.existsSync(`${candidate}.js`) ||
      fs.existsSync(`${candidate}.json`);
    const mapped = pick(rootMapped) ? rootMapped : srcMapped;
    return origResolve.call(this, mapped, parent, isMain, options);
  }
  return origResolve.call(this, request, parent, isMain, options);
};

const { runAddressExpansionTest } = require("../src/lib/social-targets/address-expansion/run-address-expansion-test");

async function main() {
  const output = await runAddressExpansionTest();
  console.log("");
  console.log(`Test target id: ${output.targetId}`);
  console.log("Report written to runtime-data/reports/address-expansion-report.json");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Address expansion test failed: ${message}`);
  process.exit(1);
});
