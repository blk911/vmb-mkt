import "server-only";
import { createHash } from "node:crypto";
import { adminDb } from "@/lib/admin/firestoreAdmin";
import { fingerprintCandidate } from "@/lib/admin/pipeline/profile-store";
import { CATALOG_COLLECTIONS, projectCatalog, type CatalogSources } from "./projection";
import type { SharedCatalog } from "./types";

/** The source documents are authoritative. This read projection copies/deletes nothing. */
export async function loadSharedCatalog(): Promise<SharedCatalog> {
  try {
    const db = adminDb();
    const sources = await db.runTransaction(async (tx) => {
      const snapshots = await Promise.all(CATALOG_COLLECTIONS.map((collection) => tx.get(db.collection(collection))));
      return Object.fromEntries(CATALOG_COLLECTIONS.map((collection, index) => [collection, snapshots[index].docs.map((doc) => ({ id: doc.id, data: doc.data(), updatedAt: doc.updateTime?.toDate().toISOString() }))])) as CatalogSources;
    }, { readOnly: true });
    const projected = projectCatalog(sources, fingerprintCandidate);
    const providerCount = projected.rows.filter((row) => row.entityType === "provider").length;
    const businessCount = projected.rows.filter((row) => row.entityType === "business").length;
    const complete = providerCount === sources.adminPipelineParsedCandidates.length && businessCount === sources.tech_index.length;
    if (!complete || new Set(projected.rows.map((row) => row.id)).size !== projected.rows.length) throw new Error("catalog_coverage_failed");
    const warnings = [
      "Business/address records are not individual providers.",
      "Source records and manual decisions remain in their original collections; no destructive migration has run.",
      ...(projected.orphanQueueCount ? [`${projected.orphanQueueCount} queue records have no matching candidate source; originals are retained.`] : []),
      ...(projected.orphanResultCount ? [`${projected.orphanResultCount} review results have no matching candidate source; originals are retained.`] : []),
    ];
    return {
      rows: projected.rows,
      generatedAt: new Date().toISOString(),
      coverage: { version: 1, storage: "firestore", strategy: "non_destructive_read_projection", complete, snapshotId: createHash("sha256").update(JSON.stringify(CATALOG_COLLECTIONS.map((collection) => [collection, sources[collection].map((doc) => [doc.id, doc.updatedAt])]))).digest("hex"), sourceCounts: Object.fromEntries(CATALOG_COLLECTIONS.map((collection) => [collection, sources[collection].length])), recordCount: projected.rows.length, providerCount, businessCount, orphanQueueCount: projected.orphanQueueCount, orphanResultCount: projected.orphanResultCount, conflictCount: projected.rows.filter((row) => row.conflicts.length).length, warnings },
    };
  } catch (error) {
    console.error("Shared catalog unavailable", error instanceof Error ? error.name : "unknown");
    // Never replace a failed durable read with bundled data or an empty-success response.
    throw new Error("catalog_store_unavailable");
  }
}
