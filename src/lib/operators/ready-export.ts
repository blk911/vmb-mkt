import fs from "node:fs";
import path from "node:path";
import type { ReadyCoreOperator } from "./ready-core";

export const READY_CORE_EXPORT_JSON_ARTIFACT = "runtime-data/operator_ready_core_export.json";
export const READY_CORE_EXPORT_CSV_ARTIFACT = "runtime-data/operator_ready_core_export.csv";

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function writeReadyCoreExportArtifacts(rows: ReadyCoreOperator[]): {
  jsonPath: string;
  csvPath: string;
} {
  const jsonPath = path.join(process.cwd(), READY_CORE_EXPORT_JSON_ARTIFACT);
  const csvPath = path.join(process.cwd(), READY_CORE_EXPORT_CSV_ARTIFACT);
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });

  fs.writeFileSync(jsonPath, `${JSON.stringify(rows, null, 2)}\n`);

  const headers = [
    "id",
    "name",
    "city",
    "normalizedCategory",
    "businessType",
    "contactPriority",
    "readyBatchTag",
    "preferredContactSurface",
    "booking",
    "instagram",
    "website",
    "phone",
    "reviewNotes",
    "evidenceCount",
    "confidenceScore",
  ];

  const lines = [headers.join(",")];
  for (const row of rows) {
    const values = [
      row.id,
      row.name || "",
      row.city || "",
      row.normalizedCategory || "",
      row.businessType || "",
      row.contactPriority || "",
      row.readyBatchTag || "",
      row.preferredContactSurface || "",
      row.canonical.booking || "",
      row.canonical.instagram || "",
      row.canonical.website || "",
      row.canonical.phone || "",
      row.reviewNotes || "",
      String(Array.isArray(row.evidence) ? row.evidence.length : 0),
      String(row.confidenceScore ?? 0),
    ].map((v) => csvEscape(v));
    lines.push(values.join(","));
  }

  fs.writeFileSync(csvPath, `${lines.join("\n")}\n`);
  return { jsonPath: READY_CORE_EXPORT_JSON_ARTIFACT, csvPath: READY_CORE_EXPORT_CSV_ARTIFACT };
}

