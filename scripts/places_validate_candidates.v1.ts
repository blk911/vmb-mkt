import fs from "fs";
import crypto from "crypto";

const RAW_PATH =
  "data/co/dora/denver_metro/places/raw/places_raw.v2.jsonl";

const DERIVED_PATH =
  "data/co/dora/denver_metro/places/derived/places_candidates.v1.json";

function sha256(content: string) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function uniq(arr: string[]) {
  return new Set(arr.filter(Boolean)).size;
}

function main() {
  const rawExists = fs.existsSync(RAW_PATH);
  const derivedExists = fs.existsSync(DERIVED_PATH);

  if (!rawExists || !derivedExists) {
    console.error({
      ok: false,
      rawExists,
      derivedExists,
    });
    process.exit(1);
  }

  const rawContent = fs.readFileSync(RAW_PATH, "utf8");
  const rawLines = rawContent
    .split("\n")
    .filter((l) => l.trim().length > 0);

  const derivedContent = fs.readFileSync(DERIVED_PATH, "utf8");
  const derivedJson = JSON.parse(derivedContent);
  const rows = derivedJson.rows || [];

  const report = {
    ok: true,
    raw: {
      lines: rawLines.length,
      sha256: sha256(rawContent),
    },
    derived: {
      rows: rows.length,
      uniqAddressKey: uniq(rows.map((r: any) => r.addressKey)),
      withTypes: rows.filter((r: any) => r.candidate?.types?.length)
        .length,
      withPhone: rows.filter((r: any) => r.candidate?.phone).length,
      withWebsite: rows.filter((r: any) => r.candidate?.website).length,
      scoreMin: Math.min(
        ...rows.map((r: any) => r.candidate?.matchScore ?? 0)
      ),
      scoreMax: Math.max(
        ...rows.map((r: any) => r.candidate?.matchScore ?? 0)
      ),
      sha256: sha256(derivedContent),
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main();
