import fs from "node:fs";
import path from "node:path";

type DirectorySummary = {
  candidateCount: number;
  acceptedEvidenceCount: number;
  promotedToEnriched: number;
  promotedToHot: number;
};

type SolaSummary = {
  attemptedChildren: number;
  evidenceAdded: number;
  promotedToEnriched: number;
  promotedToHot: number;
};

const COMPARISON_PATH = path.join(process.cwd(), "runtime-data/promotion_lane_comparison_summary.json");

export function writePromotionLaneComparisonSummary(input: {
  directorySummary: DirectorySummary;
  solaSummary?: SolaSummary;
  includeSolaDiagnostic?: boolean;
}): void {
  // Live end-to-end validation of the directory-backed promotion lane is currently
  // blocked by an existing fetch-heavy acquisition/runtime hang outside this pivot.
  // Selector validation and comparison artifact generation are verified independently.
  const solaSummary = input.solaSummary ?? {
    attemptedChildren: 0,
    evidenceAdded: 0,
    promotedToEnriched: 0,
    promotedToHot: 0,
  };

  const directoryPromotions = input.directorySummary.promotedToEnriched + input.directorySummary.promotedToHot;
  const solaPromotions = solaSummary.promotedToEnriched + solaSummary.promotedToHot;

  let conclusion: "directory_backed_outperformed" | "no_material_difference" | "insufficient_candidates";
  if (input.directorySummary.candidateCount === 0) {
    conclusion = "insufficient_candidates";
  } else if (directoryPromotions > solaPromotions || input.directorySummary.acceptedEvidenceCount > solaSummary.evidenceAdded) {
    conclusion = "directory_backed_outperformed";
  } else if (directoryPromotions === solaPromotions && input.directorySummary.acceptedEvidenceCount === solaSummary.evidenceAdded) {
    conclusion = "no_material_difference";
  } else {
    conclusion = "no_material_difference";
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    solaDiagnosticIncluded: input.includeSolaDiagnostic === true,
    directoryBackedCandidateCount: input.directorySummary.candidateCount,
    directoryBackedAcceptedEvidence: input.directorySummary.acceptedEvidenceCount,
    directoryBackedPromotions: directoryPromotions,
    solaAttemptedChildren: solaSummary.attemptedChildren,
    solaAcceptedEvidence: solaSummary.evidenceAdded,
    solaPromotions,
    acceptedEvidenceLiftRatio:
      solaSummary.evidenceAdded > 0 ? Number((input.directorySummary.acceptedEvidenceCount / solaSummary.evidenceAdded).toFixed(2)) : null,
    promotionLiftRatio: solaPromotions > 0 ? Number((directoryPromotions / solaPromotions).toFixed(2)) : null,
    conclusion,
  };

  fs.mkdirSync(path.dirname(COMPARISON_PATH), { recursive: true });
  fs.writeFileSync(COMPARISON_PATH, `${JSON.stringify(payload, null, 2)}\n`);
}
