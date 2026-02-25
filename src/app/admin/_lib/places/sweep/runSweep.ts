import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { matchedEffectiveAbs, matchedFacilitiesAbs, REL_MATCHED_EFFECTIVE, REL_MATCHED_FACILITIES, REL_SWEEP_CANDIDATES, REL_TECH_INDEX, sweepCandidatesAbs, sweepReceiptsDirAbs, techIndexAbs } from "./paths";
import { candidateKey, classifyAndScoreCandidate, suggestAddressClass } from "./scoring";
import { fetchSweepCandidatesForAddress } from "./provider";
import type { ProviderDiag } from "./provider";
import type { SweepCandidatesDoc, SweepRow } from "./types";

function nowIso() {
  return new Date().toISOString();
}

function s(v: any) {
  return String(v ?? "").trim();
}

function readJson(abs: string): any {
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function sha256Text(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function buildTechSignalsByAddress(rows: any[]) {
  const m = new Map<string, { doraLicenses: number; uniqueTechs: number; activeCount: number | null }>();
  for (const r of rows) {
    const ak = s(r?.addressKey);
    if (!ak) continue;
    const doraLicenses = Number(r?.techSignals?.techCountLicenses ?? r?.techSignals?.doraLicenses ?? 0) || 0;
    const uniqueTechs = Number(r?.techSignals?.techCountUnique ?? r?.rosterSummary?.uniqueNames ?? 0) || 0;
    const activeCount =
      r?.rosterSummary?.active != null
        ? Number(r.rosterSummary.active) || 0
        : r?.techSignals?.active != null
          ? Number(r.techSignals.active) || 0
          : null;
    m.set(ak, { doraLicenses, uniqueTechs, activeCount });
  }
  return m;
}

function countClasses(rows: SweepRow[]) {
  const out = {
    rows: rows.length,
    storefront: 0,
    suite_center: 0,
    maildrop: 0,
    residential: 0,
    unknown: 0,
    needsExternalSweep: 0,
    noExternalHits: 0,
  };
  for (const r of rows) {
    if (r.addressClass === "storefront") out.storefront += 1;
    else if (r.addressClass === "suite_center") out.suite_center += 1;
    else if (r.addressClass === "maildrop") out.maildrop += 1;
    else if (r.addressClass === "residential") out.residential += 1;
    else out.unknown += 1;

    const hasAcceptedFacility = !!r?.context?.hasAcceptedFacility;
    if (hasAcceptedFacility) continue;

    const providerMode = String(r?.source?.mode || "stub");
    const geocodeStatus = String(r?.geocode?.status || "");
    const candCount = Array.isArray(r?.sweepCandidates) ? r.sweepCandidates.length : 0;
    if (providerMode === "stub" || geocodeStatus !== "OK") {
      out.needsExternalSweep += 1;
    } else if (geocodeStatus === "OK" && candCount === 0) {
      out.noExternalHits += 1;
    }
  }
  return out;
}

export async function runAddressSweep(opts?: { limit?: number; addressKeys?: string[] }) {
  const errors: string[] = [];
  const ts = nowIso();

  if (!fs.existsSync(matchedEffectiveAbs())) {
    throw new Error(`Missing ${REL_MATCHED_EFFECTIVE}`);
  }
  if (!fs.existsSync(matchedFacilitiesAbs())) {
    throw new Error(`Missing ${REL_MATCHED_FACILITIES}`);
  }

  const matchedEffective = readJson(matchedEffectiveAbs());
  const matchedFacilities = readJson(matchedFacilitiesAbs());
  const effectiveRows: any[] = Array.isArray(matchedEffective?.rows) ? matchedEffective.rows : [];
  const facilityRows: any[] = Array.isArray(matchedFacilities?.rows) ? matchedFacilities.rows : [];

  let techRows: any[] = [];
  if (fs.existsSync(techIndexAbs())) {
    const techDoc = readJson(techIndexAbs());
    techRows = Array.isArray(techDoc?.tech) ? techDoc.tech : [];
  } else {
    errors.push(`missing_optional:${REL_TECH_INDEX}`);
  }
  const techByAk = buildTechSignalsByAddress(techRows);
  const facilityByAk = new Map<string, any>();
  for (const r of facilityRows) {
    const ak = s(r?.addressKey);
    if (ak && !facilityByAk.has(ak)) facilityByAk.set(ak, r?.facility || null);
  }

  const requested = Array.isArray(opts?.addressKeys)
    ? opts!.addressKeys.map((x) => s(x)).filter(Boolean)
    : null;

  let inputRows = effectiveRows;
  if (requested && requested.length > 0) {
    const wanted = new Set(requested);
    inputRows = effectiveRows.filter((r) => wanted.has(s(r?.addressKey)));
  } else if (opts?.limit) {
    inputRows = effectiveRows.slice(0, Math.max(0, opts.limit));
  }

  let missingSynthesized = 0;
  if (requested && requested.length > 0) {
    const have = new Set(inputRows.map((r) => s(r?.addressKey)));
    const missing = requested.filter((ak) => !have.has(ak));
    for (const ak of missing) {
      inputRows.push({
        addressKey: ak,
        placeName: "",
        placeType: "unknown",
        formattedAddress: "",
        website: null,
        phone: null,
        googleUrl: null,
        googleTypes: [],
        matchScore: 0,
        source: "operator_addressKeys",
        fetchedAt: new Date().toISOString(),
        adjudication: { addressKey: ak, decision: "unreviewed" },
      });
    }
    missingSynthesized = missing.length;
  }

  const sourceRows = inputRows;
  const rows: SweepRow[] = [];
  let processed = 0;
  const key = String(process.env.GOOGLE_MAPS_API_KEY || "").trim();
  const hasApiKey = !!key;
  const diag: ProviderDiag = {
    mode: hasApiKey ? "google" : "stub",
    hasApiKey,
    apiKeyHint: hasApiKey ? `set:${key.slice(-4)}` : "missing",
    requestCounts: { queries: 0, results: 0 },
    lastError: null,
  };

  for (const r of sourceRows) {
    const addressKey = s(r?.addressKey);
    if (!addressKey) continue;
    processed += 1;

    const decision = s(r?.adjudication?.decision || "unreviewed");
    const facility = r?.facility || facilityByAk.get(addressKey) || null;
    const hasAcceptedFacility = !!facility && decision === "accepted";
    const fromTech = techByAk.get(addressKey) || { doraLicenses: 0, uniqueTechs: 0, activeCount: null };
    const existingContext = {
      doraLicenses: Number(r?.context?.doraLicenses ?? 0) || 0,
      uniqueTechs: Number(r?.context?.uniqueTechs ?? 0) || 0,
      activeCount:
        r?.context?.activeCount != null ? Number(r.context.activeCount) || 0 : null,
    };
    const signals = {
      doraLicenses:
        existingContext.doraLicenses > 0 ? existingContext.doraLicenses : fromTech.doraLicenses,
      uniqueTechs: existingContext.uniqueTechs > 0 ? existingContext.uniqueTechs : fromTech.uniqueTechs,
      activeCount:
        existingContext.activeCount != null ? existingContext.activeCount : fromTech.activeCount,
    };

    if (hasAcceptedFacility) {
      rows.push({
        addressKey,
        addressClass: "storefront",
        sweepCandidates: [
          {
            name: s(facility?.displayName || r?.placeName || addressKey),
            placeId: undefined,
            types: [],
            website: r?.website || null,
            phone: r?.phone || null,
            googleUrl: r?.googleUrl || null,
            formattedAddress: r?.formattedAddress || null,
            query: "facility_overlay",
            atAddress: true,
            score: 100,
            reasons: ["facility_overlay_accepted"],
          },
        ],
        topCandidate: {
          name: s(facility?.displayName || r?.placeName || addressKey),
          placeId: undefined,
          types: [],
          website: r?.website || null,
          phone: r?.phone || null,
          googleUrl: r?.googleUrl || null,
          formattedAddress: r?.formattedAddress || null,
          query: "facility_overlay",
          atAddress: true,
          score: 100,
          reasons: ["facility_overlay_accepted"],
        },
        confidence: 1,
        reasons: ["facility_overlay_accepted"],
        source: { mode: diag.mode, queries: [], fetchedAt: ts },
        context: {
          hasAcceptedFacility: true,
          facilityBrand: s(facility?.brand) || null,
          doraLicenses: signals.doraLicenses,
          uniqueTechs: signals.uniqueTechs,
          activeCount: signals.activeCount,
        },
      });
      continue;
    }

    const fetched = await fetchSweepCandidatesForAddress(addressKey, diag);

    const dedup = new Map<string, ReturnType<typeof classifyAndScoreCandidate>>();
    for (const c of fetched.candidates) {
      const scored = classifyAndScoreCandidate({
        ...c,
        sourceAddressKey: addressKey,
        geocodeLocation: fetched?.geocode?.location || null,
      });
      const key = candidateKey(scored);
      const prev = dedup.get(key);
      if (!prev || scored.score > prev.score) dedup.set(key, scored);
    }
    const sweepCandidates = Array.from(dedup.values()).sort((a, b) => b.score - a.score);
    const topCandidate = sweepCandidates[0] || null;
    const suggested = suggestAddressClass({
      addressKey,
      hasAcceptedFacility: false,
      topCandidate,
      candidates: sweepCandidates,
      doraLicenses: signals.doraLicenses,
      uniqueTechs: signals.uniqueTechs,
      activeCount: signals.activeCount,
      geocodeStatus: fetched?.geocode?.status ?? null,
    });

    const row: SweepRow = {
      addressKey,
      addressClass: suggested.addressClass,
      sweepCandidates,
      topCandidate,
      confidence: suggested.confidence,
      reasons: suggested.reasons,
      geocode: fetched.geocode || null,
      source: {
        mode: diag.mode,
        queries: fetched.queries,
        fetchedAt: ts,
      },
      context: {
        hasAcceptedFacility: false,
        facilityBrand: s(facility?.brand) || null,
        doraLicenses: signals.doraLicenses,
        uniqueTechs: signals.uniqueTechs,
        activeCount: signals.activeCount,
      },
    };

    // PATCH B — reason hygiene
    const reasons = Array.isArray(row.reasons) ? row.reasons : [];
    const providerMode2 = String(row?.source?.mode || "stub");
    const geocodeStatus2 = String(row?.geocode?.status || "");
    const candCount2 = Array.isArray(row?.sweepCandidates) ? row.sweepCandidates.length : 0;

    for (let i = reasons.length - 1; i >= 0; i--) {
      if (reasons[i] === "needs_external_sweep") reasons.splice(i, 1);
      if (reasons[i] === "no_external_hits") reasons.splice(i, 1);
    }

    if (providerMode2 === "stub" || geocodeStatus2 !== "OK") {
      reasons.push("needs_external_sweep");
    } else if (geocodeStatus2 === "OK" && candCount2 === 0) {
      reasons.push("no_external_hits");
    }

    row.reasons = reasons;
    rows.push(row);
  }

  const outDoc: SweepCandidatesDoc = {
    ok: true,
    kind: "address_sweep_candidates",
    version: "v1",
    source: {
      matchedEffective: REL_MATCHED_EFFECTIVE,
      matchedFacilities: REL_MATCHED_FACILITIES,
      techIndex: REL_TECH_INDEX,
    },
    counts: countClasses(rows),
    provider: diag,
    rows,
    updatedAt: ts,
  };

  const outAbs = sweepCandidatesAbs();
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  const outText = JSON.stringify(outDoc, null, 2);
  fs.writeFileSync(outAbs, outText, "utf8");
  const outputSha256 = sha256Text(outText);

  const receipt = {
    ok: true,
    kind: "address_sweep_receipt",
    version: "v1",
    inputs: {
      matchedEffectiveRows: effectiveRows.length,
      matchedFacilitiesRows: facilityRows.length,
      techRows: techRows.length,
      requestedAddressKeys: requested?.length ?? 0,
      missingSynthesized,
    },
    processed,
    errors,
    provider: diag,
    output: REL_SWEEP_CANDIDATES,
    outputAbs: outAbs,
    sha256: outputSha256,
    updatedAt: ts,
  };

  const receiptName = `address_sweep_${ts.replace(/[:.]/g, "-")}.json`;
  const receiptAbs = path.join(sweepReceiptsDirAbs(), receiptName);
  fs.mkdirSync(path.dirname(receiptAbs), { recursive: true });
  fs.writeFileSync(receiptAbs, JSON.stringify(receipt, null, 2), "utf8");

  return {
    outAbs,
    receiptAbs,
    counts: outDoc.counts,
    processed,
    errors,
    provider: diag,
    sha256: outputSha256,
    requestedAddressKeys: requested?.length ?? 0,
    missingSynthesized,
  };
}
