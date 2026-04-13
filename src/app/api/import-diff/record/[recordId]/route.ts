import { NextResponse } from "next/server";
import { buildDiffSummary } from "@/lib/import-diff/build-diff-summary";
import { findMergeTargetsForImportedSalonRecord } from "@/lib/import-diff/find-merge-targets";
import type { ComparableImportEntity } from "@/lib/import-diff/types";
import { getImportedSalonRecordById } from "@/lib/imported-salon-records/store";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ recordId: string }> }) {
  try {
    const { recordId } = await ctx.params;
    const id = decodeURIComponent(recordId || "").trim();
    if (!id) {
      return NextResponse.json({ ok: false as const, error: "recordId_required" }, { status: 400 });
    }
    const record = await getImportedSalonRecordById(id);
    if (!record) {
      return NextResponse.json({ ok: false as const, error: "record_not_found" }, { status: 404 });
    }

    const { suggestions, topTarget } = await findMergeTargetsForImportedSalonRecord(record);
    const imported: ComparableImportEntity = {
      id: record.id,
      entityType: "imported_salon_record",
      businessName: record.businessName,
      sourceUrl: record.sourceUrl,
      bookingUrl: record.bookingUrl,
      instagramUrl: record.instagramUrl,
      serviceCount: record.services.length,
      providerCount: record.providers.length,
      portfolioImageCount: record.portfolioImages.length,
    };

    return NextResponse.json({
      ok: true as const,
      suggestions,
      diffSummary: suggestions.length ? buildDiffSummary({ imported, topSuggestion: suggestions[0], target: topTarget }) : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
