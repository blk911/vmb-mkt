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

const { runVerificationAuditSample } = require("../src/lib/social-targets/verification-audit-sample");

async function main() {
  const output = await runVerificationAuditSample();
  console.log("");
  console.log("Verification audit sample complete");
  console.log(`Sampled rows: ${output.auditedRows.length}`);
  console.log(
    `Results: live_correct=${output.summary.live_correct}, dead=${output.summary.dead}, wrong_business=${output.summary.wrong_business}, ambiguous=${output.summary.ambiguous}, no_primary_url=${output.summary.no_primary_url}`
  );
  console.log(
    `Live verified: ${output.before.liveVerified} -> ${output.after.liveVerified}; Top ready: ${output.before.topReadyCount} -> ${output.after.topReadyCount}`
  );
  console.log("Report written to runtime-data/reports/verification-audit-sample.json");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Verification audit sample failed: ${message}`);
  process.exit(1);
});
