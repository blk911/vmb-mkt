import "server-only";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { FieldPath, type Firestore } from "firebase-admin/firestore";

// This module deliberately does not import any file-backed or canonical store.
export const REVIEW_EXPORT_PROJECT = "vmb-team";
export const REVIEW_EXPORT_DATABASE = "(default)";
export const REVIEW_EXPORT_PROJECTIONS = Object.freeze({
  tech_index: Object.freeze(["id", "updatedAt"]),
  adminPipelineSourceIntakes: Object.freeze(["id", "status", "submittedAt", "parseSummary.totalCandidates", "parseSummary.parsedAt", "processSummary.processedAt", "processSummary.evidenceCreated", "processSummary.matchedCount", "processSummary.newCandidateCount", "processSummary.heldCount"]),
  adminPipelineParsedCandidates: Object.freeze(["id", "intakeId", "ordinal", "parseConfidence", "reviewAction", "suggestedMatch.disposition", "suggestedMatch.matchedOperatorId", "suggestedMatch.matchedFacilityId"]),
  adminPipelineDoraQueue: Object.freeze(["id", "intakeId", "candidateId", "createdAt", "status", "attempts", "lastAttemptAt"]),
  adminPipelineDoraResults: Object.freeze(["id", "queueItemId", "intakeId", "candidateId", "resolvedAt", "status", "finalStatus", "mergeTargetId", "reviewedAt", "targetOperatorId", "evidenceIds"]),
  adminPipelineSocialQueue: Object.freeze(["id", "intakeId", "candidateId", "createdAt", "status", "attempts", "lastAttemptAt"]),
  adminPipelineSocialResults: Object.freeze(["id", "queueItemId", "intakeId", "candidateId", "resolvedAt", "finalStatus", "mergeTargetId", "reviewedAt", "targetOperatorId", "evidenceIds"]),
});
export type ReviewExportCollection = keyof typeof REVIEW_EXPORT_PROJECTIONS;
export const REVIEW_EXPORT_COLLECTIONS = Object.freeze(Object.keys(REVIEW_EXPORT_PROJECTIONS) as ReviewExportCollection[]);
export const REVIEW_EXPORT_LIMITS = Object.freeze({
  pageSize: 500,
  maxRowsPerCollection: 25_000,
  maxTotalRows: 100_000,
  maxPagesPerCollection: 200,
  maxRequests: 500,
  maxBytes: 3_500_000,
  timeoutMs: 40_000,
});
type ReviewExportLimits = { [K in keyof typeof REVIEW_EXPORT_LIMITS]: number };

export type ReviewExportErrorCode =
  | "FIRESTORE_MODE_REQUIRED" | "ENVIRONMENT_PROJECT_MISMATCH"
  | "EMULATOR_NOT_ALLOWED" | "SDK_DEBUG_LOGGING_NOT_ALLOWED"
  | "TARGET_IDENTITY_MISMATCH" | "COLLECTION_NOT_ALLOWED" | "MUTATION_DENIED"
  | "INVALID_LIMIT_OPTION" | "INVALID_TIMESTAMP" | "INVALID_ID_TYPE"
  | "INVALID_EVIDENCE_IDS" | "INVALID_TIME_VALUE" | "UNKNOWN_DECISION_VALUE"
  | "INVALID_COUNT_VALUE" | "DOCUMENT_IDENTITY_MISMATCH" | "INVALID_PAGE_SIZE"
  | "READ_TIME_NOT_MICROSECOND_ALIGNED" | "SNAPSHOT_TIME_MISMATCH"
  | "DOCUMENT_SNAPSHOT_TIME_MISMATCH" | "INVALID_AGGREGATE_COUNT"
  | "INVALID_PAGE" | "CURSOR_NOT_STRICTLY_INCREASING" | "COUNT_DRIFT"
  | "ROW_CAP" | "PAGE_CAP" | "REQUEST_CAP" | "BYTE_CAP" | "TIMEOUT" | "READ_FAILED";

export class ReviewExportError extends Error {
  readonly code: ReviewExportErrorCode;
  readonly status: "failed" | "truncated";

  constructor(code: ReviewExportErrorCode, status: "failed" | "truncated" = "failed") {
    super(code);
    this.name = "ReviewExportError";
    this.code = code;
    this.status = status;
  }
}

function fail(code: ReviewExportErrorCode, status?: "truncated"): never {
  throw new ReviewExportError(code, status);
}

export function safeReviewExportError(error: unknown): ReviewExportError {
  // Do not retain a cause, SDK message, document content, or credential details.
  return error instanceof ReviewExportError ? error : new ReviewExportError("READ_FAILED");
}

export type ReviewExportTimestamp = { seconds: number; nanoseconds: number };
type JsonValue = null | string | number | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };
export type ReviewExportRow = { documentId: string; data: JsonObject };
export type ReviewExportDocument = {
  id: string;
  ref: { path: string };
  readTime: unknown;
  get(field: string): unknown;
};
export type ReviewExportPage = {
  readTime: unknown;
  docs: readonly ReviewExportDocument[];
  size: number;
  empty: boolean;
};
export type ReviewExportReadView = {
  readTime: unknown;
  count(name: ReviewExportCollection): Promise<unknown>;
  page(name: ReviewExportCollection, cursor: string | null, limit: number): Promise<ReviewExportPage>;
};
export type ReviewExportGate = (beforeRequest?: boolean) => void;
export type ReviewExportAdapter = {
  projectId: string;
  databaseId: string;
  snapshot<T>(work: (view: ReviewExportReadView) => Promise<T>, gate: ReviewExportGate): Promise<T>;
};

type PageProof = {
  page: number;
  startAfterDocumentId: string | null;
  firstDocumentId: string | null;
  lastDocumentId: string | null;
  returnedCount: number;
  requestedLimit: number;
  readTime: ReviewExportTimestamp;
};
type CollectionManifest = {
  status: "complete";
  projectedFields: readonly string[];
  countBefore: number;
  countAfter: number;
  exportedCount: number;
  missingStoredIdCount: number;
  storedIdDiagnostics: { absent: number; null: number; empty: number; differentFromDocumentId: number };
  cursorExhausted: true;
  pages: PageProof[];
  // Hash and bytes apply to JSON.stringify(collections[name]) in this envelope.
  bytes: number;
  sha256: string;
};
export type ReviewExportManifest = {
  schemaVersion: 1;
  format: "mktdecks-review-export-envelope";
  status: "complete";
  projectId: typeof REVIEW_EXPORT_PROJECT;
  databaseId: typeof REVIEW_EXPORT_DATABASE;
  sourceSnapshotTime: ReviewExportTimestamp;
  exportedAt: string;
  consistency: string;
  scope: string;
  privacy: string;
  limits: ReviewExportLimits;
  totalRows: number;
  logicalReadRequests: number;
  collections: Record<ReviewExportCollection, CollectionManifest>;
};
export type ReviewExportResult = { body: string; byteLength: number; manifest: ReviewExportManifest };

function checkedLimits(input: Partial<ReviewExportLimits>): ReviewExportLimits {
  const opts = { ...REVIEW_EXPORT_LIMITS, ...input };
  for (const key of Object.keys(input)) {
    if (!Object.hasOwn(REVIEW_EXPORT_LIMITS, key)) fail("INVALID_LIMIT_OPTION");
  }
  for (const key of Object.keys(opts) as (keyof ReviewExportLimits)[]) {
    if (!Number.isSafeInteger(opts[key]) || opts[key] < 1 || opts[key] > REVIEW_EXPORT_LIMITS[key]) {
      fail("INVALID_LIMIT_OPTION");
    }
  }
  return opts;
}

export function reviewExportTimestamp(value: unknown): ReviewExportTimestamp {
  if (typeof value !== "object" || value === null) fail("INVALID_TIMESTAMP");
  const { seconds, nanoseconds } = value as Partial<ReviewExportTimestamp>;
  if (typeof seconds !== "number" || typeof nanoseconds !== "number" ||
    !Number.isSafeInteger(seconds) || !Number.isInteger(nanoseconds) ||
    nanoseconds < 0 || nanoseconds > 999_999_999 || seconds < -62_135_596_800 || seconds > 253_402_300_799) {
    fail("INVALID_TIMESTAMP");
  }
  return { seconds, nanoseconds };
}

function sameTimestamp(a: unknown, b: unknown): boolean {
  const x = reviewExportTimestamp(a), y = reviewExportTimestamp(b);
  return x.seconds === y.seconds && x.nanoseconds === y.nanoseconds;
}

function exactId(value: unknown): string {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > 8192) fail("INVALID_ID_TYPE");
  return value; // Never normalize, trim, deduplicate, infer, or concatenate IDs.
}

const ENUMS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  parseConfidence: ["high", "medium", "low"],
  reviewAction: ["accept_match", "force_new", "hold", "pending"],
  "suggestedMatch.disposition": ["matched", "possible_match", "new_candidate", "held"],
  finalStatus: ["approved", "merged", "rejected"],
});
const QUEUE_STATUSES = ["queued", "processing", "resolved", "approved", "merged", "rejected", "failed", "dismissed"];

function metadataValue(collection: ReviewExportCollection, field: string, value: unknown): JsonValue | undefined {
  if (value === undefined || value === null) return value;
  if (field === "evidenceIds") {
    if (!Array.isArray(value) || value.length > 10_000) fail("INVALID_EVIDENCE_IDS");
    return value.map(exactId);
  }
  if (field === "id" || /Id$/.test(field)) return exactId(value);
  if (/At$/.test(field)) {
    if (typeof value === "string") {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) fail("INVALID_TIME_VALUE");
      return value;
    }
    return { type: "firestoreTimestamp", ...reviewExportTimestamp(value) };
  }
  let accepted = ENUMS[field];
  if (field === "status") {
    accepted = collection === "adminPipelineSourceIntakes" ? ["pending", "parsed", "processed", "failed"]
      : collection === "adminPipelineDoraResults" ? ["active_match", "inactive_match", "possible_match", "not_found"]
        : QUEUE_STATUSES;
  }
  if (accepted) {
    if (typeof value !== "string" || !accepted.includes(value)) fail("UNKNOWN_DECISION_VALUE");
    return value;
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) fail("INVALID_COUNT_VALUE");
  return value;
}

function assertCollection(name: string): asserts name is ReviewExportCollection {
  if (!Object.hasOwn(REVIEW_EXPORT_PROJECTIONS, name)) fail("COLLECTION_NOT_ALLOWED");
}

export function serializeReviewExportDocument(collection: ReviewExportCollection, doc: ReviewExportDocument): ReviewExportRow {
  assertCollection(collection);
  const documentId = exactId(doc.id);
  if (!documentId || documentId.includes("/") || doc.ref?.path !== `${collection}/${documentId}`) fail("DOCUMENT_IDENTITY_MISMATCH");
  const data: JsonObject = {};
  // Independently enforce leaf projection: never call doc.data(), even on a fake.
  for (const field of REVIEW_EXPORT_PROJECTIONS[collection]) {
    const value = metadataValue(collection, field, doc.get(field));
    if (value === undefined) continue;
    const parts = field.split(".");
    let target = data;
    for (const part of parts.slice(0, -1)) target = (target[part] ??= {}) as JsonObject;
    target[parts[parts.length - 1]] = value;
  }
  return { documentId, data };
}

const MUTATORS = new Set<PropertyKey>(["create", "set", "update", "delete", "add", "batch", "bulkWriter", "recursiveDelete", "commit", "write", "import", "exportDocuments"]);
function readOnlyView<T extends object>(methods: T): T {
  return new Proxy(Object.freeze(methods), {
    get(target, property, receiver) {
      if (MUTATORS.has(property)) fail("MUTATION_DENIED");
      return Reflect.get(target, property, receiver);
    },
    set() { return fail("MUTATION_DENIED"); },
    defineProperty() { return fail("MUTATION_DENIED"); },
    deleteProperty() { return fail("MUTATION_DENIED"); },
  });
}

export function makeReviewExportAdapter(db: Firestore, fields: Pick<typeof FieldPath, "documentId"> = FieldPath): ReviewExportAdapter {
  // Locked Firestore 7.11.6 exposes projectId at runtime, but omits it from its
  // public type. Fail closed if a future SDK no longer exposes that identity.
  if (!("projectId" in db) || db.projectId !== REVIEW_EXPORT_PROJECT || db.databaseId !== REVIEW_EXPORT_DATABASE) fail("TARGET_IDENTITY_MISMATCH");
  const base = (name: ReviewExportCollection) => {
    assertCollection(name);
    return db.collection(name).orderBy(fields.documentId(), "asc").select(...REVIEW_EXPORT_PROJECTIONS[name]);
  };
  return readOnlyView({
    projectId: REVIEW_EXPORT_PROJECT,
    databaseId: REVIEW_EXPORT_DATABASE,
    async snapshot<T>(work: (view: ReviewExportReadView) => Promise<T>, gate: ReviewExportGate): Promise<T> {
      gate(true);
      // No bootstrap content: select() is the SDK's document-ID-only projection.
      const anchor = await db.collection("tech_index").orderBy(fields.documentId(), "asc").select().limit(1).get();
      gate();
      const fixedTime = anchor.readTime;
      if (reviewExportTimestamp(fixedTime).nanoseconds % 1000 !== 0) fail("READ_TIME_NOT_MICROSECOND_ALIGNED");
      return db.runTransaction(async (tx) => {
        const checkedRead = async <T extends { readTime: unknown }>(read: () => Promise<T>): Promise<T> => {
          gate(true);
          const result = await read();
          gate();
          if (!sameTimestamp(result.readTime, fixedTime)) fail("SNAPSHOT_TIME_MISMATCH");
          return result;
        };
        return work(readOnlyView<ReviewExportReadView>({
          readTime: reviewExportTimestamp(fixedTime),
          async count(name) { return (await checkedRead(() => tx.get(base(name).count()))).data().count; },
          async page(name, cursor, limit) {
            if (!Number.isSafeInteger(limit) || limit < 1 || limit > REVIEW_EXPORT_LIMITS.pageSize) fail("INVALID_PAGE_SIZE");
            let query = base(name).limit(limit);
            if (cursor !== null) query = query.startAfter(exactId(cursor));
            return checkedRead(() => tx.get(query));
          },
        }));
      }, { readOnly: true, readTime: fixedTime });
    },
  });
}

// Injectable core accepts only reduced limits for offline tests. Production has
// no caller-provided options and never accepts an arbitrary collection or target.
export async function collectReviewExportWithAdapter(adapter: ReviewExportAdapter, testLimits: Partial<ReviewExportLimits> = {}): Promise<ReviewExportResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expired = false;
  try {
    const opts = checkedLimits(testLimits);
    if (adapter.projectId !== REVIEW_EXPORT_PROJECT || adapter.databaseId !== REVIEW_EXPORT_DATABASE) fail("TARGET_IDENTITY_MISMATCH");
    const started = performance.now();
    let requestCount = 0;
    const gate: ReviewExportGate = (beforeRequest = false) => {
      if (expired || performance.now() - started >= opts.timeoutMs) fail("TIMEOUT", "truncated");
      if (beforeRequest && ++requestCount > opts.maxRequests) fail("REQUEST_CAP", "truncated");
    };
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { expired = true; reject(new ReviewExportError("TIMEOUT", "truncated")); }, opts.timeoutMs);
    });
    const operation = adapter.snapshot(async (view) => {
      gate();
      const readTime = reviewExportTimestamp(view.readTime);
      let totalRows = 0, rowBytes = 0, collectionBytes = 0;
      const collections = {} as Record<ReviewExportCollection, ReviewExportRow[]>;
      const collectionMetadata = {} as Record<ReviewExportCollection, CollectionManifest>;
      for (const name of REVIEW_EXPORT_COLLECTIONS) {
        gate();
        const expectedCount = await view.count(name);
        gate();
        if (typeof expectedCount !== "number" || !Number.isSafeInteger(expectedCount) || expectedCount < 0) fail("INVALID_AGGREGATE_COUNT");
        if (expectedCount > opts.maxRowsPerCollection || totalRows + expectedCount > opts.maxTotalRows) fail("ROW_CAP", "truncated");
        if (Math.ceil(expectedCount / opts.pageSize) + 1 > opts.maxPagesPerCollection) fail("PAGE_CAP", "truncated");
        const rows: ReviewExportRow[] = [], pages: PageProof[] = [];
        let cursor: string | null = null;
        const storedIdDiagnostics = { absent: 0, null: 0, empty: 0, differentFromDocumentId: 0 };
        while (true) {
          gate();
          if (pages.length >= opts.maxPagesPerCollection) fail("PAGE_CAP", "truncated");
          const page = await view.page(name, cursor, opts.pageSize);
          gate();
          if (!sameTimestamp(page.readTime, readTime)) fail("SNAPSHOT_TIME_MISMATCH");
          if (!Array.isArray(page.docs) || page.docs.length > opts.pageSize || page.size !== page.docs.length || page.empty !== (page.docs.length === 0)) fail("INVALID_PAGE");
          const before = cursor;
          for (const doc of page.docs) {
            gate();
            if (!sameTimestamp(doc.readTime, readTime)) fail("DOCUMENT_SNAPSHOT_TIME_MISMATCH");
            const row = serializeReviewExportDocument(name, doc);
            if (cursor !== null && Buffer.compare(Buffer.from(row.documentId), Buffer.from(cursor)) <= 0) fail("CURSOR_NOT_STRICTLY_INCREASING");
            if (rows.length >= expectedCount) fail("COUNT_DRIFT");
            if (++totalRows > opts.maxTotalRows || rows.length >= opts.maxRowsPerCollection) fail("ROW_CAP", "truncated");
            rowBytes += Buffer.byteLength(JSON.stringify(row), "utf8") + 1;
            if (rowBytes > opts.maxBytes) fail("BYTE_CAP", "truncated");
            if (!Object.hasOwn(row.data, "id")) storedIdDiagnostics.absent++;
            else if (row.data.id === null) storedIdDiagnostics.null++;
            else {
              if (row.data.id === "") storedIdDiagnostics.empty++;
              if (row.data.id !== row.documentId) storedIdDiagnostics.differentFromDocumentId++;
            }
            rows.push(row);
            cursor = row.documentId;
          }
          pages.push({ page: pages.length + 1, startAfterDocumentId: before, firstDocumentId: page.docs[0]?.id ?? null, lastDocumentId: page.docs[page.docs.length - 1]?.id ?? null, returnedCount: page.docs.length, requestedLimit: opts.pageSize, readTime });
          // Even a short final page must be followed by an actual empty query.
          if (page.docs.length === 0) break;
        }
        const finalCount = await view.count(name);
        gate();
        if (finalCount !== expectedCount || rows.length !== expectedCount) fail("COUNT_DRIFT");
        const content = JSON.stringify(rows);
        const bytes = Buffer.byteLength(content, "utf8");
        collectionBytes += bytes;
        if (collectionBytes > opts.maxBytes) fail("BYTE_CAP", "truncated");
        collections[name] = rows;
        collectionMetadata[name] = { status: "complete", projectedFields: REVIEW_EXPORT_PROJECTIONS[name], countBefore: expectedCount, countAfter: finalCount, exportedCount: rows.length, missingStoredIdCount: storedIdDiagnostics.absent, storedIdDiagnostics, cursorExhausted: true, pages, bytes, sha256: createHash("sha256").update(content, "utf8").digest("hex") };
      }
      gate();
      const manifest: ReviewExportManifest = {
        schemaVersion: 1, format: "mktdecks-review-export-envelope", status: "complete",
        projectId: REVIEW_EXPORT_PROJECT, databaseId: REVIEW_EXPORT_DATABASE,
        sourceSnapshotTime: readTime, exportedAt: new Date().toISOString(),
        consistency: "Server readTime pinned on every count and page through a read-only transaction; every collection has an explicit empty terminal page.",
        scope: "Only seven allowlisted canonical ID/review-metadata collections; not a full migration-universe export.",
        privacy: "Exact IDs, selected decisions, timestamps and counts only; no prospect content or outreach collection.",
        limits: opts, totalRows, logicalReadRequests: requestCount, collections: collectionMetadata,
      };
      const body = JSON.stringify({ manifest, collections }) + "\n";
      const byteLength = Buffer.byteLength(body, "utf8");
      // The final cap includes the complete envelope, proof, hashes and newline.
      if (byteLength > opts.maxBytes) fail("BYTE_CAP", "truncated");
      gate();
      return { body, byteLength, manifest };
    }, gate);
    // A stalled SDK read cannot hold the HTTP request past the application deadline.
    // An in-flight transport request may finish later. Gates stop subsequent reads;
    // this deadline/logical-request cap is not cancellation or a billing ceiling.
    return await Promise.race([operation, timeout]);
  } catch (error) {
    throw safeReviewExportError(error);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    expired = true;
  }
}

export function assertReviewExportEnvironment(env: NodeJS.ProcessEnv): void {
  // Inspect only these settings and credential presence; never load/dump env files.
  if (env.VMB_CANONICAL_PIPELINE_STORE?.trim() !== "firestore" || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) fail("FIRESTORE_MODE_REQUIRED");
  if (env.FIREBASE_PROJECT_ID !== REVIEW_EXPORT_PROJECT) fail("ENVIRONMENT_PROJECT_MISMATCH");
  if (env.FIRESTORE_EMULATOR_HOST) fail("EMULATOR_NOT_ALLOWED");
  if (env.FIRESTORE_LOGGING || env.GRPC_TRACE || env.GRPC_VERBOSITY || env.GOOGLE_SDK_NODE_LOGGING) fail("SDK_DEBUG_LOGGING_NOT_ALLOWED");
  for (const key of ["GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT"]) {
    if (env[key] && env[key] !== REVIEW_EXPORT_PROJECT) fail("ENVIRONMENT_PROJECT_MISMATCH");
  }
}

// Called only by the authenticated admin route, after its access/request checks.
export async function collectReviewExport(): Promise<ReviewExportResult> {
  try {
    assertReviewExportEnvironment(process.env);
    const { adminDb } = await import("./firestoreAdmin");
    return await collectReviewExportWithAdapter(makeReviewExportAdapter(adminDb()));
  } catch (error) {
    throw safeReviewExportError(error);
  }
}
