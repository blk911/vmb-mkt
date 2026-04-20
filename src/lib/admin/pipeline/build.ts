import type { BuildSourceType, BuildSubmissionResult, BuildSubmissionSummary } from "./types";

type BuildRequestConfig = {
  endpoint: string;
  body: unknown;
};

type JsonRecord = Record<string, unknown>;

function parseJsonMaybe(rawText: string): unknown | null {
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function toNonEmptyLines(rawText: string): string[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseDelimitedRows(rawText: string): Record<string, string>[] {
  const lines = toNonEmptyLines(rawText);
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(delimiter).map((value) => value.trim()).filter(Boolean);
  if (!headers.length) return [];

  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter).map((value) => value.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] || "";
    });
    return row;
  });
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getJsonRecord(value: unknown, key: string): JsonRecord | null {
  if (!isJsonRecord(value)) return null;
  const nested = value[key];
  return isJsonRecord(nested) ? nested : null;
}

function getArrayLength(value: unknown, key: string): number {
  if (!isJsonRecord(value)) return 0;
  const nested = value[key];
  return Array.isArray(nested) ? nested.length : 0;
}

function getNumberValue(value: unknown, key: string): number {
  if (!isJsonRecord(value)) return 0;
  return Number(value[key] ?? 0);
}

export function normalizeBuildUploadRecords(
  sourceType: Exclude<BuildSourceType, "Instagram">,
  rawText: string
): Record<string, unknown>[] {
  const parsed = parseJsonMaybe(rawText);
  if (Array.isArray(parsed)) {
    return parsed.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
  }

  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { records?: unknown[] }).records)) {
    return ((parsed as { records: unknown[] }).records || []).filter(
      (row): row is Record<string, unknown> => Boolean(row && typeof row === "object")
    );
  }

  const delimitedRows = parseDelimitedRows(rawText);
  if (delimitedRows.length) return delimitedRows;

  const lines = toNonEmptyLines(rawText);
  if (sourceType === "URL") {
    return lines.map((line) => ({ sourceUrl: line, website: line }));
  }
  if (sourceType === "DORA") {
    return lines.map((line) => ({ businessName: line }));
  }
  return lines.map((line) => ({ name: line }));
}

export function buildRequestConfig(sourceType: BuildSourceType, rawText: string): BuildRequestConfig {
  if (sourceType === "Instagram") {
    return {
      endpoint: "/api/hashtag-paste-intake",
      body: {
        platform: "instagram",
        rawText,
      },
    };
  }

  return {
    endpoint: "/api/operators/upload",
    body: {
      records: normalizeBuildUploadRecords(sourceType, rawText),
    },
  };
}

function summarizeHashtagResult(data: unknown): BuildSubmissionSummary {
  const result = getJsonRecord(data, "result");
  return {
    recordsReceived: getArrayLength(result, "parsedPosts"),
    evidenceAdded: 0,
    operatorsCreated: 0,
    notes: [
      `providerCandidates: ${getArrayLength(result, "providerCandidates")}`,
      `clientSignalPosts: ${getArrayLength(result, "clientSignalPosts")}`,
    ],
  };
}

function summarizeUploadResult(data: unknown): BuildSubmissionSummary {
  const summary = getJsonRecord(data, "summary");
  return {
    recordsReceived: getNumberValue(summary, "recordsReceived"),
    evidenceAdded: getNumberValue(summary, "evidenceAdded"),
    operatorsCreated: getNumberValue(summary, "operatorsCreated"),
    notes: [`recordsAccepted: ${getNumberValue(summary, "recordsAccepted")}`],
  };
}

export function normalizeBuildResponse(sourceType: BuildSourceType, endpoint: string, data: unknown): BuildSubmissionResult {
  if (!isJsonRecord(data) || data.ok !== true) {
    return {
      ok: false,
      endpoint,
      error: isJsonRecord(data) && typeof data.error === "string" ? data.error : "request_failed",
    };
  }

  const summary = sourceType === "Instagram" ? summarizeHashtagResult(data) : summarizeUploadResult(data);
  return {
    ok: true,
    endpoint,
    summary,
    raw: data,
  };
}
