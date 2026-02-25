import { NextResponse } from "next/server";
import { parseSmart } from "../../../../../admin/_lib/facilities/parse";
import { previewFacilities } from "../../../../../admin/_lib/facilities/match";
import {
  appendSeedsIdempotent,
  materializeFacilityIndex,
  writeReceipt,
} from "../../../../../admin/_lib/facilities/materialize";
import { brandDefaultSeedFile, normSpace } from "../../../../../admin/_lib/facilities/normalize";
import { enrichTechIndexWithFacilities } from "../../../../../admin/_lib/facilities/enrichTech";
import { enrichPlacesTop200WithFacilities } from "../../../../../admin/_lib/facilities/enrichPlaces";
import { enrichPlacesMatchedWithFacilities } from "../../../../../admin/_lib/facilities/enrichPlacesMatched";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const format = normSpace(body?.format || "jsonl").toLowerCase();
    const text = String(body?.text ?? "");
    const defaults = body?.defaults ?? {};
    const operatorNote = normSpace(body?.operatorNote || "");

    const parsed = parseSmart(text, format === "csv" ? "csv" : "jsonl", {
      brand: normSpace(defaults.brand || ""),
      category: normSpace(defaults.category || ""),
      source: normSpace(defaults.source || "operator_import"),
    });

    const rows = parsed.map((r) => ({
      ...r,
      brand: normSpace(r.brand || defaults.brand || ""),
      category: normSpace(r.category || defaults.category || ""),
      source: normSpace(r.source || defaults.source || "operator_import"),
    }));

    const preview = previewFacilities(rows);

    // commit only NOT FOUND (valid + no match)
    const notFoundRows = preview.notFound.map((p: any) => p.input);

    const seedFileName =
      normSpace(body?.seedFileName) ||
      brandDefaultSeedFile(defaults.brand || rows[0]?.brand || "facilities");

    const appendRes = appendSeedsIdempotent({
      seedFileName,
      rows: notFoundRows,
    });

    const idx = materializeFacilityIndex();
    let techEnrich: any = null;
    try {
      techEnrich = enrichTechIndexWithFacilities();
    } catch (e: any) {
      // Don't fail the commit if tech enrichment fails - but report it.
      techEnrich = { ok: false, error: e?.message || "tech_enrich_failed" };
    }
    let placesEnrich: any = null;
    try {
      placesEnrich = enrichPlacesTop200WithFacilities();
    } catch (e: any) {
      // Don't fail the commit if places enrichment fails - but report it.
      placesEnrich = { ok: false, error: e?.message || "places_enrich_failed" };
    }
    let matchedEnrich: any = null;
    try {
      matchedEnrich = enrichPlacesMatchedWithFacilities();
    } catch (e: any) {
      matchedEnrich = { ok: false, error: e?.message || "places_matched_enrich_failed" };
    }

    const receipt = {
      kind: "facilities_import_receipt",
      version: "v1",
      operatorNote,
      format,
      seedFileName,
      counts: {
        input: preview.counts.input,
        matched: preview.counts.matched,
        notFound: preview.counts.notFound,
        invalid: preview.counts.invalid,
        appended: appendRes.added,
        skippedExisting: appendRes.skippedExisting,
        facilityIndexFacilities: idx.counts.facilities,
        techFacilitiesAttached: techEnrich?.attached ?? 0,
        techFacilitiesTotal: techEnrich?.facilitiesTotal ?? 0,
        techIndexFacilitiesUpdatedAt: techEnrich?.updatedAt ?? null,
        placesFacilitiesAttached: placesEnrich?.attached ?? 0,
        placesFacilitiesTotal: placesEnrich?.facilitiesTotal ?? 0,
        placesFacilitiesUpdatedAt: placesEnrich?.updatedAt ?? null,
        placesMatchedFacilitiesPath: matchedEnrich?.outAbs ?? null,
        placesMatchedFacilitiesAttached: matchedEnrich?.attached ?? 0,
        placesMatchedFacilitiesExact: matchedEnrich?.attachedExact ?? 0,
        placesMatchedFacilitiesNorm: matchedEnrich?.attachedNorm ?? 0,
        placesMatchedFacilitiesBase: matchedEnrich?.attachedBase ?? 0,
        placesMatchedFacilitiesUpdatedAt: matchedEnrich?.updatedAt ?? null,
        placesMatchedFacilitiesError: matchedEnrich?.error ?? null,
      },
      placesFacilitiesError: placesEnrich?.error ?? null,
      updatedAt: new Date().toISOString(),
    };

    const receiptAbs = writeReceipt(receipt);

    return NextResponse.json({
      ok: true,
      receipt,
      receiptPath: receiptAbs,
      seedFilePath: appendRes.seedFileAbs,
      facilityIndexUpdatedAt: idx.updatedAt,
      facilityIndexCount: idx.counts.facilities,
      techIndexFacilitiesPath: techEnrich?.outAbs ?? null,
      techIndexFacilitiesAttached: techEnrich?.attached ?? 0,
      techIndexFacilitiesUpdatedAt: techEnrich?.updatedAt ?? null,
      techIndexFacilitiesError: techEnrich?.error ?? null,
      placesFacilitiesPath: placesEnrich?.outAbs ?? null,
      placesFacilitiesAttached: placesEnrich?.attached ?? 0,
      placesFacilitiesUpdatedAt: placesEnrich?.updatedAt ?? null,
      placesFacilitiesError: placesEnrich?.error ?? null,
      placesMatchedFacilitiesPath: matchedEnrich?.outAbs ?? null,
      placesMatchedFacilitiesAttached: matchedEnrich?.attached ?? 0,
      placesMatchedFacilitiesExact: matchedEnrich?.attachedExact ?? 0,
      placesMatchedFacilitiesNorm: matchedEnrich?.attachedNorm ?? 0,
      placesMatchedFacilitiesBase: matchedEnrich?.attachedBase ?? 0,
      placesMatchedFacilitiesUpdatedAt: matchedEnrich?.updatedAt ?? null,
      placesMatchedFacilitiesError: matchedEnrich?.error ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "commit_failed" }, { status: 500 });
  }
}
