import fs from "node:fs";
import path from "node:path";
import type { OperatorRecord } from "@/lib/operators/types";
import { getOutreachEligibility } from "@/lib/operators/outreach-eligibility";
import { buildOperatorQualitySummary } from "@/lib/operators/quality-summary";
import { applyReviewOverlay, getReviewStateOrDefault } from "@/lib/operators/review-store";
import HotTargetReviewPanel from "@/components/admin/operators/HotTargetReviewPanel";

function loadOperators(): OperatorRecord[] {
  const filePath = path.join(process.cwd(), "runtime-data/operator_master.v1.json");
  if (!fs.existsSync(filePath)) return [];
  const rows = JSON.parse(fs.readFileSync(filePath, "utf-8")) as OperatorRecord[];
  return applyReviewOverlay(rows);
}

type FilterMode = "all" | "hot" | "ready" | "shelved_by_review";

function normalizeFilter(raw?: string): FilterMode {
  if (raw === "hot" || raw === "ready" || raw === "shelved_by_review") return raw;
  return "all";
}

export default function OperatorsPage({
  searchParams,
}: {
  searchParams?: { filter?: string };
}) {
  const filter = normalizeFilter(searchParams?.filter);
  const operators = loadOperators()
    .map((op) => ({ op, outreach: getOutreachEligibility(op) }))
    .sort((a, b) => {
      if (a.outreach.eligible !== b.outreach.eligible) return a.outreach.eligible ? -1 : 1;
      if (a.op.status !== b.op.status) {
        if (a.op.status === "hot") return -1;
        if (b.op.status === "hot") return 1;
      }
      if (a.op.confidenceScore !== b.op.confidenceScore) return b.op.confidenceScore - a.op.confidenceScore;
      return (a.op.name || "").localeCompare(b.op.name || "");
    });
  const filteredOperators = operators.filter(({ op }) => {
    if (filter === "hot") return op.status === "hot";
    if (filter === "ready") return getReviewStateOrDefault(op.reviewState) === "ready";
    if (filter === "shelved_by_review") return getReviewStateOrDefault(op.reviewState) === "shelved_by_review";
    return true;
  });
  const quality = buildOperatorQualitySummary(filteredOperators.map((row) => row.op));
  const hot = operators.filter(({ op }) => op.status === "hot");
  const shelved = operators.filter(({ op }) => op.status === "shelved");

  const evidenceCount = (op: OperatorRecord) => (Array.isArray(op.evidence) && op.evidence.length > 0 ? op.evidence.length : 0);
  const sourceTypeLabel = (op: OperatorRecord) => {
    const tags = new Set<string>();
    if (op.sources.google) tags.add("google");
    if (op.sources.instagram) tags.add("instagram");
    if (op.sources.booking) tags.add("booking");
    for (const row of op.evidence || []) {
      if (row.evidenceType === "directory_listing") tags.add("directory");
      if (row.evidenceType === "suite_container") tags.add("container");
    }
    return [...tags].join(" / ");
  };
  const evidenceTypeLabel = (op: OperatorRecord) => {
    const tags = new Set<string>();
    for (const row of op.evidence || []) {
      if (row.evidenceType) tags.add(row.evidenceType);
    }
    return [...tags].join(" / ");
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600 }}>Operator Console</h1>
      <div style={{ marginTop: 12 }}>
        <strong>Total:</strong> {operators.length} | <strong>Hot:</strong> {hot.length} | <strong>Shelved:</strong>{" "}
        {shelved.length}
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
        <a href="/admin/operators?filter=all" style={{ fontWeight: filter === "all" ? 700 : 400 }}>
          all
        </a>
        <a href="/admin/operators?filter=hot" style={{ fontWeight: filter === "hot" ? 700 : 400 }}>
          hot
        </a>
        <a href="/admin/operators?filter=ready" style={{ fontWeight: filter === "ready" ? 700 : 400 }}>
          ready
        </a>
        <a
          href="/admin/operators?filter=shelved_by_review"
          style={{ fontWeight: filter === "shelved_by_review" ? 700 : 400 }}
        >
          shelved by review
        </a>
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 13,
          color: "#333",
          display: "flex",
          flexWrap: "wrap",
          gap: "10px 16px",
        }}
      >
        <span>
          <strong>Total:</strong> {quality.totalOperators}
        </span>
        <span>
          <strong>Hot:</strong> {quality.hotCount}
        </span>
        <span>
          <strong>Shelved:</strong> {quality.shelvedCount}
        </span>
        <span>
          <strong>With IG:</strong> {quality.withInstagramCount}
        </span>
        <span>
          <strong>With Booking:</strong> {quality.withBookingCount}
        </span>
        <span>
          <strong>IG + Booking:</strong> {quality.withInstagramAndBookingCount}
        </span>
        <span>
          <strong>Directory evidence:</strong> {quality.withDirectoryEvidenceCount}
        </span>
        <span>
          <strong>Container evidence:</strong> {quality.withContainerEvidenceCount}
        </span>
        <span>
          <strong>Unknown names:</strong> {quality.unknownNameCount}
        </span>
        <span>
          <strong>Suspicious cities:</strong> {quality.suspiciousCityCount}
        </span>
      </div>

      <table
        style={{
          width: "100%",
          marginTop: 20,
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr>
            <th align="left">Name</th>
            <th align="left">City</th>
            <th>IG</th>
            <th>Booking</th>
            <th>Status</th>
            <th>Review</th>
            <th>Score</th>
            <th>Channel</th>
            <th>Outreach</th>
            <th>Reason</th>
            <th>Evidence</th>
            <th>Source Types</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredOperators.map(({ op, outreach }) => (
            <tr key={op.id} style={{ borderTop: "1px solid #eee" }}>
              <td>{op.name}</td>
              <td>{op.city}</td>
              <td>
                {op.canonical.instagram && (
                  <a href={op.canonical.instagram} target="_blank" rel="noreferrer">
                    IG
                  </a>
                )}
              </td>
              <td>
                {op.canonical.booking && (
                  <a href={op.canonical.booking} target="_blank" rel="noreferrer">
                    Book
                  </a>
                )}
              </td>
              <td>
                <span
                  style={{
                    color: op.status === "hot" ? "green" : op.status === "shelved" ? "orange" : "gray",
                  }}
                >
                  {op.status}
                </span>
              </td>
              <td>{getReviewStateOrDefault(op.reviewState)}</td>
              <td>{op.confidenceScore}</td>
              <td>{outreach.preferredChannel}</td>
              <td>{outreach.eligible ? "ready" : "blocked"}</td>
              <td>{outreach.reason}</td>
              <td>{evidenceCount(op)}</td>
              <td style={{ fontSize: 12, color: "#555" }}>{sourceTypeLabel(op)}</td>
              <td>
                {op.status === "hot" ? (
                  <HotTargetReviewPanel
                    operatorId={op.id}
                    canonicalName={op.name}
                    city={op.city}
                    instagram={op.canonical.instagram}
                    booking={op.canonical.booking}
                    website={op.canonical.website}
                    evidenceCount={evidenceCount(op)}
                    sourceTypes={sourceTypeLabel(op)}
                    evidenceTypes={evidenceTypeLabel(op)}
                    reviewState={getReviewStateOrDefault(op.reviewState)}
                    reviewNotes={op.reviewNotes}
                  />
                ) : (
                  <span style={{ color: "#888", fontSize: 12 }}>hot-only review</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
