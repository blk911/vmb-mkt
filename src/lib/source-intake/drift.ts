import { findDriftEventForPair, saveDriftEvent } from "./phase2-store";
import { scoreNameMatch } from "./matcher";
import { createSourceIntakeId, getSourceIntakeById, listParsedCandidates, listSourceIntakes } from "./store";
import type { DriftChange, SourceIntakeDriftEvent } from "./phase2-types";
import type { ParsedCandidateRow } from "./types";

function normalizeText(value?: string): string {
  return (value || "").trim().toLowerCase();
}

function normalizeSourceLabel(value?: string): string {
  return normalizeText(value).replace(/\s+/g, " ");
}

function sameRole(a?: string, b?: string): boolean {
  return normalizeText(a) === normalizeText(b);
}

function samePrice(a?: number | null, b?: number | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 0.009;
}

function strongerConfidence(a: ParsedCandidateRow, b: ParsedCandidateRow): ParsedCandidateRow["parseConfidence"] {
  const rank = { low: 1, medium: 2, high: 3 };
  return rank[a.parseConfidence] >= rank[b.parseConfidence] ? a.parseConfidence : b.parseConfidence;
}

function exactNameMatch(
  baselineRows: ParsedCandidateRow[],
  comparisonRow: ParsedCandidateRow,
  usedBaselineIds: Set<string>
): ParsedCandidateRow | null {
  const wanted = normalizeText(comparisonRow.displayName);
  const match = baselineRows.find(
    (row) => !usedBaselineIds.has(row.id) && normalizeText(row.displayName) === wanted
  );
  return match ?? null;
}

function fuzzyNameMatch(
  baselineRows: ParsedCandidateRow[],
  comparisonRow: ParsedCandidateRow,
  usedBaselineIds: Set<string>
): ParsedCandidateRow | null {
  const ranked = baselineRows
    .filter((row) => !usedBaselineIds.has(row.id))
    .map((row) => ({ row, score: scoreNameMatch(row.displayName, comparisonRow.displayName) }))
    .sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (!top || top.score < 92) return null;
  const roleContinuous = sameRole(top.row.roleLabel, comparisonRow.roleLabel);
  const priceContinuous = samePrice(top.row.priceValue ?? null, comparisonRow.priceValue ?? null);
  if (!roleContinuous && !priceContinuous) return null;
  return top.row;
}

function buildChange(
  type: DriftChange["type"],
  baseline: ParsedCandidateRow | null,
  comparison: ParsedCandidateRow | null,
  reasons: string[]
): DriftChange {
  return {
    type,
    baselineCandidateId: baseline?.id,
    comparisonCandidateId: comparison?.id,
    baselineDisplayName: baseline?.displayName,
    comparisonDisplayName: comparison?.displayName,
    baselineRole: baseline?.roleLabel,
    comparisonRole: comparison?.roleLabel,
    baselinePrice: baseline?.priceValue ?? null,
    comparisonPrice: comparison?.priceValue ?? null,
    confidence:
      baseline && comparison ? strongerConfidence(baseline, comparison) : baseline?.parseConfidence ?? comparison?.parseConfidence ?? "low",
    reasons,
  };
}

export async function computeIntakeDrift(intakeId: string): Promise<SourceIntakeDriftEvent | null> {
  const comparisonIntake = await getSourceIntakeById(intakeId);
  if (!comparisonIntake || comparisonIntake.status !== "processed") return null;

  const allIntakes = await listSourceIntakes();
  const previousComparable = allIntakes
    .filter((row) => row.id !== intakeId && row.status === "processed" && row.submittedAt < comparisonIntake.submittedAt)
    .filter((row) =>
      comparisonIntake.facilityId
        ? row.facilityId === comparisonIntake.facilityId
        : normalizeSourceLabel(row.sourceLabel) === normalizeSourceLabel(comparisonIntake.sourceLabel)
    )
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];

  if (!previousComparable) return null;

  const existing = await findDriftEventForPair(previousComparable.id, comparisonIntake.id);
  if (existing) return existing;

  const [baselineRows, comparisonRows] = await Promise.all([
    listParsedCandidates(previousComparable.id),
    listParsedCandidates(comparisonIntake.id),
  ]);
  if (!baselineRows.length || !comparisonRows.length) return null;

  const changes: DriftChange[] = [];
  const usedBaselineIds = new Set<string>();

  for (const comparisonRow of comparisonRows) {
    let baselineRow = exactNameMatch(baselineRows, comparisonRow, usedBaselineIds);
    let matchedByFuzzyName = false;
    if (!baselineRow) {
      baselineRow = fuzzyNameMatch(baselineRows, comparisonRow, usedBaselineIds);
      matchedByFuzzyName = Boolean(baselineRow);
    }

    if (!baselineRow) {
      changes.push(
        buildChange("added_person", null, comparisonRow, [
          "candidate did not exist in prior comparable processed intake",
        ])
      );
      continue;
    }

    usedBaselineIds.add(baselineRow.id);

    if (matchedByFuzzyName && normalizeText(baselineRow.displayName) !== normalizeText(comparisonRow.displayName)) {
      changes.push(
        buildChange("name_changed", baselineRow, comparisonRow, [
          "strong near-match with role and/or price continuity",
        ])
      );
    }

    if (!sameRole(baselineRow.roleLabel, comparisonRow.roleLabel)) {
      changes.push(
        buildChange("role_changed", baselineRow, comparisonRow, [
          "role label changed between comparable roster snapshots",
        ])
      );
    }

    if (!samePrice(baselineRow.priceValue ?? null, comparisonRow.priceValue ?? null)) {
      changes.push(
        buildChange("price_changed", baselineRow, comparisonRow, [
          "price changed between comparable roster snapshots",
        ])
      );
    }
  }

  for (const baselineRow of baselineRows) {
    if (usedBaselineIds.has(baselineRow.id)) continue;
    changes.push(
      buildChange("removed_person", baselineRow, null, [
        "candidate no longer appears in newer comparable processed intake",
      ])
    );
  }

  if (!changes.length) return null;

  const event: SourceIntakeDriftEvent = {
    id: createSourceIntakeId("sid"),
    sourceLabel: comparisonIntake.sourceLabel,
    facilityId: comparisonIntake.facilityId,
    baselineIntakeId: previousComparable.id,
    comparisonIntakeId: comparisonIntake.id,
    detectedAt: new Date().toISOString(),
    changes,
    summary: {
      added: changes.filter((row) => row.type === "added_person").length,
      removed: changes.filter((row) => row.type === "removed_person").length,
      roleChanged: changes.filter((row) => row.type === "role_changed").length,
      priceChanged: changes.filter((row) => row.type === "price_changed").length,
      nameChanged: changes.filter((row) => row.type === "name_changed").length,
    },
  };

  await saveDriftEvent(event);
  return event;
}
