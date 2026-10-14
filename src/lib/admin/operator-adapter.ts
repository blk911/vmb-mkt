import { safeProfileHref } from "@/lib/admin/pipeline/profile-presentation";
import { loadSharedCatalog } from "@/lib/catalog/store";

export type CanonicalOperator = {
  id: string;
  name: string;
  city: string;
  ig?: string;
  status: "approved" | "rejected" | "merged";
  score: number;
  category?: string;
  validationConfidence?: number;
  followerCount?: number;
};

/** Compatibility projection over the shared catalog, never a parallel identity store. */
export async function listCanonicalOperators(): Promise<CanonicalOperator[]> {
  const catalog = await loadSharedCatalog();
  return catalog.rows.filter((row) => row.entityType === "provider" && row.reviewStatus === "approved").map((row) => ({
    id: row.id,
    name: row.providerName || row.displayName,
    city: row.city || "Unknown",
    ig: row.profile?.socialLinks.find((link) => safeProfileHref(link.url) && /(^|\.)instagram\.com$/.test(new URL(link.url).hostname))?.url,
    status: "approved" as const,
    // Approval and retrieval are separate. No invented ranking or confidence.
    score: 0,
    category: row.services[0] || "unknown",
  }));
}
