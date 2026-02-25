import fs from "node:fs";
import path from "node:path";
import { REL_SWEEP_ADJUDICATIONS, REL_SWEEP_CANDIDATES, sweepCandidatesAbs, sweepEffectiveAbs } from "./paths";
import { indexSweepAdjudicationsByAddressKey, readSweepAdjudications } from "./adjudications";
import type { AddressClass } from "./types";

function nowIso() {
  return new Date().toISOString();
}

function effectiveClassFromDecision(decision: string): AddressClass | null {
  if (decision === "suite_center") return "suite_center";
  if (decision === "residential") return "residential";
  if (decision === "rejected") return "unknown";
  if (decision === "unknown" || decision === "no_storefront") return "unknown";
  return null;
}

export function materializeAddressSweepEffective() {
  const srcAbs = sweepCandidatesAbs();
  if (!fs.existsSync(srcAbs)) throw new Error(`Missing ${srcAbs}`);

  const src = JSON.parse(fs.readFileSync(srcAbs, "utf8"));
  const rows: any[] = Array.isArray(src?.rows) ? src.rows : [];

  const adjDoc = readSweepAdjudications();
  const byAk = indexSweepAdjudicationsByAddressKey(adjDoc);

  let confirmedCandidate = 0;
  let manualSuiteCenter = 0;
  let manualResidential = 0;
  let manualUnknown = 0;
  let unreviewed = 0;

  const outRows = rows.map((r) => {
    const ak = String(r?.addressKey || "").trim();
    const adj = ak ? byAk.get(ak) : null;
    const decision = String(adj?.decision || "unreviewed");

    let effectiveAddressClass: AddressClass = (r?.addressClass as AddressClass) || "unknown";
    let effectiveTopCandidate = r?.topCandidate || null;

    if (adj?.decision === "confirm_candidate") {
      confirmedCandidate += 1;
      effectiveAddressClass = "storefront";
      const pick = Array.isArray(r?.sweepCandidates)
        ? r.sweepCandidates.find((c: any) => String(c?.placeId || "") === String(adj?.selectedCandidatePlaceId || ""))
        : null;
      if (pick) effectiveTopCandidate = pick;
      else if (adj?.selectedCandidateName) {
        effectiveTopCandidate = {
          ...(r?.topCandidate || {}),
          name: adj.selectedCandidateName,
          placeId: adj.selectedCandidatePlaceId || undefined,
        };
      }
    } else {
      const forced = effectiveClassFromDecision(decision);
      if (forced) effectiveAddressClass = forced;

      if (decision === "suite_center") manualSuiteCenter += 1;
      else if (decision === "residential") manualResidential += 1;
      else if (decision === "unknown" || decision === "no_storefront" || decision === "rejected")
        manualUnknown += 1;
      else unreviewed += 1;
    }

    return {
      ...r,
      adjudication: adj ?? { addressKey: ak, decision: "unreviewed" },
      effectiveAddressClass,
      effectiveTopCandidate,
    };
  });

  const outDoc = {
    ok: true,
    kind: "address_sweep_effective",
    version: "v1",
    source: {
      candidates: REL_SWEEP_CANDIDATES,
      adjudications: REL_SWEEP_ADJUDICATIONS,
    },
    counts: {
      rows: outRows.length,
      confirmedCandidate,
      manualSuiteCenter,
      manualResidential,
      manualUnknown,
      unreviewed,
    },
    rows: outRows,
    updatedAt: nowIso(),
  };

  const outAbs = sweepEffectiveAbs();
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, JSON.stringify(outDoc, null, 2), "utf8");

  return { outAbs, counts: outDoc.counts, updatedAt: outDoc.updatedAt };
}
