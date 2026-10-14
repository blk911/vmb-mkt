import type { ParsedCandidateRow, SourceIntakeRecord } from "@/lib/source-intake/types";
import type { ProfileLink, ProfileRefinementRecord } from "@/lib/admin/pipeline/profile-types";
import { recoverCandidateProfile, reconcileCandidateProfile } from "@/lib/admin/pipeline/profile-model";
import { adaptCandidateEvidence, adaptLegacyBusinessEvidence } from "./source-adapters";
import { auditCatalogEvidence } from "./evidence-audit";
import type { CatalogDecision, CatalogRecord, CatalogSourceRef } from "./types";

export type SourceDocument = { id: string; data: Record<string, unknown>; updatedAt?: string };
export type CatalogSources = Record<string, SourceDocument[]>;
export const CATALOG_COLLECTIONS = ["tech_index", "adminPipelineSourceIntakes", "adminPipelineParsedCandidates", "adminPipelineDoraQueue", "adminPipelineDoraResults", "adminPipelineSocialQueue", "adminPipelineSocialResults", "adminPipelineProfileRefinements", "adminPipelineOperatorEvidence"] as const;
const str = (value: unknown) => typeof value === "string" ? value.trim() : "";
const obj = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const strings = (value: unknown): string[] => Array.isArray(value) ? value.map(str).filter(Boolean) : str(value) ? [str(value)] : [];
const uniq = (values: string[]) => [...new Set(values.filter(Boolean))];
const ref = (collection: string, id: string, role: CatalogSourceRef["role"] = "source"): CatalogSourceRef => ({ collection, id, role });
const rawId = (value: unknown) => typeof value === "string" ? value : "";
const candidateKey = (doc: SourceDocument) => JSON.stringify([rawId(doc.data.intakeId), typeof doc.data.id === "string" ? doc.data.id : doc.id]);
const evidenceKey = (data: Record<string, unknown>) => str(data.intakeId) && str(data.candidateId) ? JSON.stringify([rawId(data.intakeId), rawId(data.candidateId)]) : "";
const iso = (...values: unknown[]) => values.map(str).filter((v) => Number.isFinite(Date.parse(v))).sort().at(-1) || "";

export function aggregateReviewStatus(decisions: CatalogDecision[], queueStatuses: string[], reviewAction?: string): string {
  const explicit = uniq(decisions.map((decision) => decision.status).filter((status) => ["approved", "rejected", "merged"].includes(status)));
  if (explicit.length > 1 || uniq(decisions.filter((decision) => decision.status === "merged").map((decision) => decision.targetId || "missing")).length > 1) return "conflict";
  if (reviewAction === "hold") return explicit.length ? "conflict" : "held";
  if (explicit[0] === "rejected" || explicit[0] === "merged") return explicit[0];
  if (explicit[0] === "approved") {
    const lanes = new Set(decisions.filter((decision) => decision.status === "approved").map((decision) => decision.lane));
    return lanes.size >= queueStatuses.length ? "approved" : "partially_reviewed";
  }
  // Queue status alone is not evidence that a manual review result was saved.
  return queueStatuses.some((status) => ["approved", "rejected", "merged"].includes(status)) ? "review_result_missing" : "pending";
}

function legacyBusiness(doc: SourceDocument, recoverEvidence = true): CatalogRecord {
  const data = doc.data, address = obj(data.address), premise = obj(data.premise), place = obj(obj(data.places).best);
  const displayName = str(data.displayName) || str(place.name) || str(address.street) || doc.id;
  const sourceId = str(data.id);
  let profile = recoverCandidateProfile({
    id: doc.id, intakeId: "tech_index", ordinal: 0, rawBlock: "", displayName: "", parseConfidence: "low",
    businessName: displayName, city: str(address.city), state: str(address.state), postalCode: str(address.zip),
    websiteUrl: str(premise.website) || str(place.website), bookingUrl: str(data.bookingUrl),
  });
  const recovered = adaptLegacyBusinessEvidence(doc);
  if (recoverEvidence) profile = reconcileCandidateProfile({ ...profile, platformEvidence: [...(profile.platformEvidence || []), ...recovered.platformEvidence] }, recovered.links);
  // A business website/social page cannot be promoted to a person's identity.
  profile.providerName = "";
  delete profile.providerId;
  for (const link of [...profile.bookingLinks, ...profile.socialLinks, ...profile.websiteLinks]) link.attribution = link.kind === "directory" ? "unresolved" : "business";
  const placeId = str(place.placeId) || str(place.id);
  const addressKey = str(data.addressKey);
  return {
    id: `business:tech_index:${doc.id}`, entityType: "business", displayName, providerName: "", businessName: displayName,
    platformLabel: profile.platformLabel, profile, city: str(address.city), state: str(address.state), postalCode: str(address.zip),
    area: str(data.area) || str(data.zoneName) || str(data.beautyZoneName),
    services: uniq([...strings(premise.types), ...strings(place.types), ...strings(data.tags)]),
    reviewStatus: "source_record", sourceRefs: [ref("tech_index", doc.id)],
    linkedEntities: [
      { id: `place:tech_index:${doc.id}`, entityType: "place", label: [str(address.street), str(address.city), str(address.zip)].filter(Boolean).join(", ") || addressKey || "Address record", relationship: "recorded_location", basis: "exact_source_id" },
      ...(placeId ? [{ id: `place:google:${placeId}`, entityType: "place" as const, label: str(place.name) || placeId, relationship: "source_place_match", basis: "source_reported" as const }] : []),
    ],
    reviewDecisions: [], conflicts: sourceId && sourceId !== doc.id ? ["stored_id_differs_from_document_id"] : [],
    evidence: [{ id: `evidence:tech_index:${doc.id}`, kind: "business_address_record", label: "Original business/address source retained", observedAt: str(data.updatedAt) || doc.updatedAt }],
    factClaims: recoverEvidence ? recovered.factClaims : [],
    updatedAt: iso(data.updatedAt, doc.updatedAt), legacyIds: uniq([doc.id, sourceId]),
    phone: str(premise.phone) || str(place.phone),
    address: { street: str(address.street), city: str(address.city), state: str(address.state), zip: str(address.zip) },
  };
}

export function projectCatalog(sources: CatalogSources, fingerprint: (candidate: ParsedCandidateRow, evidenceLinks?: readonly ProfileLink[]) => string) {
  const get = (collection: string) => sources[collection] || [];
  const rows = get("tech_index").map((doc) => legacyBusiness(doc));
  const beforeRows: Array<Pick<CatalogRecord, "profile" | "factClaims">> = get("tech_index").map((doc) => legacyBusiness(doc, false));
  const intakes = new Map(get("adminPipelineSourceIntakes").map((doc) => [str(doc.data.id) || doc.id, doc]));
  const candidates = get("adminPipelineParsedCandidates");
  const keys = new Set(candidates.map(candidateKey));
  const queues = ["Dora", "Social"].flatMap((lane) => get(`adminPipeline${lane}Queue`).map((doc) => ({ ...doc, lane: lane.toUpperCase(), collection: `adminPipeline${lane}Queue` })));
  const results = ["Dora", "Social"].flatMap((lane) => get(`adminPipeline${lane}Results`).map((doc) => ({ ...doc, lane: lane.toUpperCase(), collection: `adminPipeline${lane}Results` })));
  const heads = get("adminPipelineProfileRefinements");
  const stagedEvidence = get("adminPipelineOperatorEvidence");
  const orphanEvidence = stagedEvidence.filter((doc) => !keys.has(evidenceKey(doc.data)));
  const orphanQueues = queues.filter((doc) => !keys.has(evidenceKey(doc.data)));
  const orphanResults = results.filter((doc) => !keys.has(evidenceKey(doc.data)));
  const duplicateKeys = new Set(candidates.filter((doc, index) => candidates.findIndex((other) => candidateKey(other) === candidateKey(doc)) !== index).map(candidateKey));
  for (const doc of candidates) {
    const candidate = { ...doc.data, id: typeof doc.data.id === "string" ? doc.data.id : doc.id, intakeId: typeof doc.data.intakeId === "string" ? doc.data.intakeId : "", displayName: typeof doc.data.displayName === "string" ? doc.data.displayName : "", rawBlock: typeof doc.data.rawBlock === "string" ? doc.data.rawBlock : "", parseConfidence: doc.data.parseConfidence || "low" } as ParsedCandidateRow;
    const reviewKey = `${candidate.intakeId}::${candidate.id}`;
    const laneQueues = queues.filter((queue) => evidenceKey(queue.data) === candidateKey(doc));
    const laneResults = results.filter((result) => evidenceKey(result.data) === candidateKey(doc));
    const base = recoverCandidateProfile(candidate);
    const candidateEvidence = stagedEvidence.filter((evidence) => evidenceKey(evidence.data) === candidateKey(doc));
    const recovered = adaptCandidateEvidence(base, candidate.displayName, laneResults, candidateEvidence);
    const currentFingerprint = fingerprint(candidate, recovered.links);
    const exactCandidateRef = JSON.stringify([candidate.intakeId, candidate.id]);
    // Old delimiter keys are ambiguous when either ID contains a colon. Require stronger association then.
    const unambiguousLegacyKey = !candidate.intakeId.includes(":") && !candidate.id.includes(":");
    const head = heads.filter((head) => {
      const record = obj(head.data.record), savedProfile = obj(record.profile);
      return record.reviewKey === reviewKey && (unambiguousLegacyKey || record.fingerprint === currentFingerprint || savedProfile.candidateRef === exactCandidateRef);
    }).sort((a, b) => iso(obj(b.data.record).completedAt, b.updatedAt).localeCompare(iso(obj(a.data.record).completedAt, a.updatedAt)) || a.id.localeCompare(b.id))[0];
    const rawSaved = head?.data.record as ProfileRefinementRecord | undefined;
    // Bind an old unscoped cache clone only after the source identity association above is established.
    const saved = rawSaved && rawSaved.profile && (!rawSaved.profile.candidateRef || rawSaved.profile.candidateRef === reviewKey)
      ? { ...rawSaved, profile: { ...rawSaved.profile, candidateRef: exactCandidateRef } } : rawSaved;
    const validSaved = saved && saved.schemaVersion === 1 && saved.profile?.schemaVersion === 1 && Array.isArray(saved.profile.bookingLinks) && Array.isArray(saved.profile.socialLinks) && Array.isArray(saved.profile.websiteLinks) && Array.isArray(saved.profile.reasons) && Array.isArray(saved.profile.observations) && [...saved.profile.bookingLinks, ...saved.profile.socialLinks, ...saved.profile.websiteLinks].every((link) => link && typeof link.url === "string") && saved.profile.observations.every((entry) => entry && Array.isArray(entry.claims));
    const exactSaved = validSaved && saved.fingerprint === currentFingerprint;
    let profile = validSaved ? (exactSaved ? reconcileCandidateProfile(saved.profile, base, recovered.links) : reconcileCandidateProfile(base, saved.profile, recovered.links)) : reconcileCandidateProfile(base, recovered.links);
    if (validSaved && !exactSaved) { delete profile.nextAttemptAt; profile.freshness = "stale"; }
    profile.providerName = candidate.displayName;
    // Explicit-field baseline is computed from the exact same source snapshot, not a prior/live count.
    const primary = { ...candidate, rawBlock: "", sourceEvidenceLinks: undefined };
    beforeRows.push({ profile: exactSaved ? saved.profile : recoverCandidateProfile(primary), factClaims: [] });
    if (profile.nextAttemptAt && Date.parse(profile.nextAttemptAt) <= Date.now()) profile = { ...profile, freshness: "stale" };
    const decisions: CatalogDecision[] = laneResults.map((result) => ({ id: result.id, lane: result.lane, status: str(result.data.finalStatus) || "unreviewed", reviewedAt: str(result.data.reviewedAt) || undefined, reviewedBy: str(result.data.reviewedBy) || undefined, targetId: str(result.data.mergeTargetId) || undefined, suggestedTargetId: str(result.data.targetOperatorId) || undefined }));
    const status = aggregateReviewStatus(decisions, uniq(laneQueues.map((queue) => queue.lane)).map((lane) => str(laneQueues.find((queue) => queue.lane === lane)?.data.status)), candidate.reviewAction);
    const conflicts = [...profile.reasons.filter((reason) => reason.startsWith("conflicting_") || reason === "multiple_booking_platforms"), ...recovered.conflicts];
    if (laneResults.some((result) => !laneQueues.some((queue) => queue.lane === result.lane && (queue.id === result.data.queueItemId || queue.data.id === result.data.queueItemId)))) conflicts.push("review_result_queue_mismatch");
    if (laneResults.some((result) => {
      const queue = laneQueues.find((queue) => queue.lane === result.lane && (queue.id === result.data.queueItemId || queue.data.id === result.data.queueItemId));
      return queue && ["approved", "rejected", "merged"].includes(str(queue.data.status)) && str(result.data.finalStatus) && queue.data.status !== result.data.finalStatus;
    })) conflicts.push("review_queue_status_disagreement");
    if (decisions.some((decision) => decision.status === "merged" && !decision.targetId)) conflicts.push("merge_target_missing");
    if (status === "conflict") conflicts.push("conflicting_manual_review_decisions");
    if (duplicateKeys.has(candidateKey(doc))) conflicts.push("duplicate_candidate_source_key");
    if (new Set(laneQueues.map((queue) => queue.lane)).size !== laneQueues.length) conflicts.push("duplicate_candidate_lane_queue");
    const intake = intakes.get(candidate.intakeId);
    const rawIntake = intake?.data as SourceIntakeRecord | undefined;
    const sourceRefs = [ref("adminPipelineParsedCandidates", doc.id), ...(intake ? [ref("adminPipelineSourceIntakes", intake.id)] : []), ...laneQueues.map((queue) => ref(queue.collection, queue.id, "review")), ...laneResults.map((result) => ref(result.collection, result.id, "review")), ...candidateEvidence.map((evidence) => ref("adminPipelineOperatorEvidence", evidence.id)), ...(head ? [ref("adminPipelineProfileRefinements", head.id, "profile")] : []), ...(saved?.runId ? [ref("adminPipelineProfileRefinementRuns", saved.runId, "profile")] : [])];
    const links: CatalogRecord["linkedEntities"] = [];
    if (profile.businessName || profile.businessId) links.push({ id: `business:source:${doc.id}`, entityType: "business", label: profile.businessName || profile.businessId || "Unknown business", relationship: "source_reported_business", basis: "source_reported" });
    for (const decision of decisions.filter((decision) => decision.targetId && decision.status === "merged")) links.push({ id: `operator:${decision.targetId}`, entityType: "provider", label: decision.targetId!, relationship: decision.status === "merged" ? "reviewed_merge_target" : "reviewed_operator_target", basis: "reviewed" });
    rows.push({
      id: `provider:adminPipelineParsedCandidates:${doc.id}`, entityType: "provider", displayName: candidate.displayName || "Unnamed source candidate", providerName: candidate.displayName, businessName: profile.businessName || "", platformLabel: profile.platformLabel, profile,
      city: profile.city || "", state: profile.state || "", postalCode: profile.postalCode || "", area: str(doc.data.area) || str(doc.data.zoneName),
      services: uniq([candidate.serviceHint || "", candidate.roleLabel || ""]), reviewStatus: conflicts.some((conflict) => ["duplicate_candidate_source_key", "review_result_queue_mismatch", "review_queue_status_disagreement", "merge_target_missing", "duplicate_candidate_lane_queue"].includes(conflict)) ? "conflict" : status, reviewKey,
      sourceRefs, linkedEntities: links, reviewDecisions: decisions, conflicts,
      evidence: [{ id: `evidence:candidate:${doc.id}`, kind: "source_candidate", label: rawIntake?.sourceLabel || "Original candidate source retained", sourceUrl: profile.sourceContextUrl || candidate.sourceUrl, observedAt: rawIntake?.submittedAt }, ...recovered.factClaims.map((fact) => ({ id: fact.id, kind: fact.kind, label: `${fact.status}: ${fact.value}`, sourceUrl: fact.sourceUrl, observedAt: fact.observedAt })), ...profile.observations.map((observation, index) => ({ id: `evidence:profile:${doc.id}:${saved?.runId || "source"}:${index}`, kind: observation.outcome, label: "Profile retrieval observation", sourceUrl: observation.sourceUrl, observedAt: observation.fetchedAt }))],
      factClaims: recovered.factClaims,
      updatedAt: iso(doc.updatedAt, rawIntake?.submittedAt, saved?.completedAt, ...candidateEvidence.map((evidence) => evidence.data.observedAt), ...laneResults.flatMap((result) => [result.data.reviewedAt, result.data.resolvedAt])),
      legacyIds: [`approved:${candidate.intakeId}:${candidate.id}`],
      sourceIdentifiers: { candidateId: candidate.id, intakeId: candidate.intakeId, providerId: profile.providerId, businessId: profile.businessId, sourceScopedIds: candidate.sourceScopedIds },
    });
  }
  return { rows, orphanQueueCount: orphanQueues.length, orphanResultCount: orphanResults.length, orphanEvidenceCount: orphanEvidence.length, evidenceAudit: auditCatalogEvidence(beforeRows, rows, [...get("tech_index").map((doc) => `business:tech_index:${doc.id}`), ...candidates.map((doc) => `provider:adminPipelineParsedCandidates:${doc.id}`)], candidates.filter((doc) => doc.data.rawBlockTruncated === true || strings(doc.data.parseWarnings).some((warning) => /truncat/i.test(warning))).length) };
}
