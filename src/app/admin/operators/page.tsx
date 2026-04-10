import type { OperatorRecord } from "@/lib/operators/types";
import { AdminTopNav } from "@/components/admin/AdminTopNav";
import { getOutreachEligibility } from "@/lib/operators/outreach-eligibility";
import { buildOperatorQualitySummary } from "@/lib/operators/quality-summary";
import { getReviewStateOrDefault } from "@/lib/operators/review-store";
import { loadOperatorsFromResolverRegistry, type OperatorConsoleRow } from "@/lib/operators/loadOperators";
import HotTargetReviewPanel from "@/components/admin/operators/HotTargetReviewPanel";

function loadOperators(): OperatorConsoleRow[] {
  return loadOperatorsFromResolverRegistry();
}

type FilterMode = "all" | "hot" | "ready" | "shelved_by_review";

function normalizeFilter(raw?: string): FilterMode {
  if (raw === "hot" || raw === "ready" || raw === "shelved_by_review") return raw;
  return "all";
}

function flagOn(value?: string): boolean {
  return value === "1";
}

export default function OperatorsPage({
  searchParams,
}: {
  searchParams?: {
    filter?: string;
    showContainers?: string;
    showContainerDerivedOnly?: string;
    showDiscard?: string;
    showEnumerated?: string;
    showProvisionalChildren?: string;
    showLowSignal?: string;
  };
}) {
  const filter = normalizeFilter(searchParams?.filter);
  const showContainers = searchParams?.showContainers === "1";
  const showContainerDerivedOnly = flagOn(searchParams?.showContainerDerivedOnly);
  const showDiscard = flagOn(searchParams?.showDiscard);
  const showEnumerated = flagOn(searchParams?.showEnumerated);
  const showProvisionalChildren = flagOn(searchParams?.showProvisionalChildren);
  const showLowSignal = flagOn(searchParams?.showLowSignal);
  const isPureContainerParent = (op: OperatorConsoleRow): boolean => {
    const hasDirectSurface = Boolean(op.canonical.booking || op.canonical.instagram || op.canonical.website);
    if (hasDirectSurface) return false;
    if (!op.isContainer) return false;
    const hasContainerEvidence = (op.evidence || []).some(
      (row) => row.evidenceType === "suite_container" || row.source === "container"
    );
    const hasDirectEvidence = (op.evidence || []).some((row) => row.evidenceType === "direct_operator");
    return hasContainerEvidence && !hasDirectEvidence;
  };
  const operators = loadOperators()
    .map((op) => ({ op, outreach: getOutreachEligibility(op) }))
    .sort((a, b) => {
      if (a.outreach.eligible !== b.outreach.eligible) return a.outreach.eligible ? -1 : 1;
      if (a.op.resolverStatus !== b.op.resolverStatus) {
        if (a.op.resolverStatus === "hot") return -1;
        if (b.op.resolverStatus === "hot") return 1;
      }
      if (a.op.confidenceScore !== b.op.confidenceScore) return b.op.confidenceScore - a.op.confidenceScore;
      return (a.op.name || "").localeCompare(b.op.name || "");
    });
  const filteredOperators = operators.filter(({ op }) => {
    if (filter === "hot") return op.resolverStatus === "hot";
    if (filter === "ready") return getReviewStateOrDefault(op.reviewState) === "ready";
    if (filter === "shelved_by_review") return getReviewStateOrDefault(op.reviewState) === "shelved_by_review";
    return true;
  }).filter(({ op }) => {
    const isContainerDerived = op.operatorType === "child_operator" || Boolean(op.parentContainerId);
    if (showContainerDerivedOnly && !isContainerDerived) return false;
    const hasSurface = Boolean(op.canonical.booking || op.canonical.instagram || op.canonical.website);
    const lowSignal = op.confidenceScore <= 1 && !hasSurface;
    const defaultTierVisible =
      op.resolverStatus === "hot" || op.resolverStatus === "enriched" || op.childState === "resolved_child";
    if (!showContainers && isPureContainerParent(op)) return false;
    if (!showDiscard && op.resolverStatus === "shelved") return false;
    if (!showEnumerated && !defaultTierVisible) return false;
    if (!showProvisionalChildren && op.childState === "provisional_child") return false;
    if (!showLowSignal && lowSignal) return false;
    return true;
  });
  const quality = buildOperatorQualitySummary(filteredOperators.map((row) => row.op));
  const hot = operators.filter(({ op }) => op.resolverStatus === "hot");
  const enriched = operators.filter(({ op }) => op.resolverStatus === "enriched");
  const enumerated = operators.filter(({ op }) => op.resolverStatus === "enumerated");
  const readyCount = operators.filter(({ op }) => getReviewStateOrDefault(op.reviewState) === "ready").length;

  const evidenceCount = (op: OperatorRecord) => (Array.isArray(op.evidence) && op.evidence.length > 0 ? op.evidence.length : 0);
  const sourceTypeLabel = (op: OperatorRecord) => {
    const tags = new Set<string>();
    if (op.sources.website) tags.add("website");
    if (op.sources.google) tags.add("google");
    if (op.sources.instagram) tags.add("instagram");
    if (op.sources.booking) tags.add("booking");
    if (op.sources.directory) tags.add("directory");
    if (op.sources.container) tags.add("container");
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
  const cell = {
    padding: "8px 6px",
    verticalAlign: "top",
    fontSize: 12,
    lineHeight: 1.3,
    borderTop: "1px solid #eee",
  };
  const truncate = {
    display: "inline-block",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  return (
    <main style={{ minHeight: "100vh", background: "#fafafa" }}>
      <AdminTopNav />
      <div style={{ padding: "18px 20px", maxWidth: 1400 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Operator Console</h1>
        <div style={{ marginTop: 8, display: "flex", gap: 12, fontSize: 13 }}>
          <a href="/admin/operators">Operators</a>
          <a href="/admin/operators/children">Children</a>
          <a href="/admin/operators/ready">Ready</a>
          <a href="/admin/operators/surface-recovery">Surface Recovery</a>
        </div>
        <div style={{ marginTop: 12 }}>
        <strong>Resolver operators:</strong> {operators.length} | <strong>Rendered:</strong> {filteredOperators.length} |{" "}
        <strong>Hot:</strong> {hot.length} | <strong>Enriched:</strong> {enriched.length} |{" "}
        <strong>Enumerated:</strong> {enumerated.length} |{" "}
        <a href="/admin/operators/ready">
          <strong>Ready Core:</strong> {readyCount}
        </a>
        {" | "}
        <a href="/admin/operators/surface-recovery">
          <strong>Surface Recovery</strong>
        </a>
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
        <a
          href={`/admin/operators?filter=${filter}&showContainers=${showContainers ? "0" : "1"}&showContainerDerivedOnly=${showContainerDerivedOnly ? "1" : "0"}&showDiscard=${showDiscard ? "1" : "0"}&showEnumerated=${showEnumerated ? "1" : "0"}&showProvisionalChildren=${showProvisionalChildren ? "1" : "0"}&showLowSignal=${showLowSignal ? "1" : "0"}`}
          style={{ fontWeight: 500 }}
        >
          {showContainers ? "hide containers" : "show containers"}
        </a>
        <a
          href={`/admin/operators?filter=${filter}&showContainers=${showContainers ? "1" : "0"}&showContainerDerivedOnly=${showContainerDerivedOnly ? "0" : "1"}&showDiscard=${showDiscard ? "1" : "0"}&showEnumerated=${showEnumerated ? "1" : "0"}&showProvisionalChildren=${showProvisionalChildren ? "1" : "0"}&showLowSignal=${showLowSignal ? "1" : "0"}`}
          style={{ fontWeight: 500 }}
        >
          {showContainerDerivedOnly ? "show all operators" : "show container-derived only"}
        </a>
        <a
          href={`/admin/operators?filter=${filter}&showContainers=${showContainers ? "1" : "0"}&showContainerDerivedOnly=${showContainerDerivedOnly ? "1" : "0"}&showDiscard=${showDiscard ? "0" : "1"}&showEnumerated=${showEnumerated ? "1" : "0"}&showProvisionalChildren=${showProvisionalChildren ? "1" : "0"}&showLowSignal=${showLowSignal ? "1" : "0"}`}
          style={{ fontWeight: 500 }}
        >
          {showDiscard ? "hide discard/shelved" : "show discard/shelved"}
        </a>
        <a
          href={`/admin/operators?filter=${filter}&showContainers=${showContainers ? "1" : "0"}&showContainerDerivedOnly=${showContainerDerivedOnly ? "1" : "0"}&showDiscard=${showDiscard ? "1" : "0"}&showEnumerated=${showEnumerated ? "0" : "1"}&showProvisionalChildren=${showProvisionalChildren ? "1" : "0"}&showLowSignal=${showLowSignal ? "1" : "0"}`}
          style={{ fontWeight: 500 }}
        >
          {showEnumerated ? "hide enumerated" : "show enumerated"}
        </a>
        <a
          href={`/admin/operators?filter=${filter}&showContainers=${showContainers ? "1" : "0"}&showContainerDerivedOnly=${showContainerDerivedOnly ? "1" : "0"}&showDiscard=${showDiscard ? "1" : "0"}&showEnumerated=${showEnumerated ? "1" : "0"}&showProvisionalChildren=${showProvisionalChildren ? "0" : "1"}&showLowSignal=${showLowSignal ? "1" : "0"}`}
          style={{ fontWeight: 500 }}
        >
          {showProvisionalChildren ? "hide provisional child" : "show provisional child"}
        </a>
        <a
          href={`/admin/operators?filter=${filter}&showContainers=${showContainers ? "1" : "0"}&showContainerDerivedOnly=${showContainerDerivedOnly ? "1" : "0"}&showDiscard=${showDiscard ? "1" : "0"}&showEnumerated=${showEnumerated ? "1" : "0"}&showProvisionalChildren=${showProvisionalChildren ? "1" : "0"}&showLowSignal=${showLowSignal ? "0" : "1"}`}
          style={{ fontWeight: 500 }}
        >
          {showLowSignal ? "hide low signal" : "show low signal"}
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

        <div style={{ width: "100%", overflowX: "auto", marginTop: 20 }}>
      <table
        style={{
          width: "100%",
          minWidth: 1530,
          borderCollapse: "collapse",
          tableLayout: "fixed",
        }}
      >
        <thead>
          <tr>
            <th align="left" style={{ width: "20%", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>Name</th>
            <th align="left" style={{ width: "8%", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>City</th>
            <th align="left" style={{ width: "10%", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>Parent</th>
            <th style={{ width: "4%", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>IG</th>
            <th style={{ width: "6%", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>Booking</th>
            <th style={{ width: "6%", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>Status</th>
            <th style={{ width: "8%", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>Review</th>
            <th style={{ width: "4%", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>Score</th>
            <th style={{ width: "6%", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>Channel</th>
            <th style={{ width: "6%", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>Outreach</th>
            <th style={{ width: "9%", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>Reason</th>
            <th style={{ width: "5%", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>Evidence</th>
            <th style={{ width: "10%", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>Source Types</th>
            <th style={{ width: "12%", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>Action</th>
            <th style={{ width: "20%", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>Evidence Details</th>
          </tr>
        </thead>
        <tbody>
          {filteredOperators.map(({ op, outreach }) => (
            <tr key={op.id}>
              <td style={cell} title={op.name}>
                <span style={truncate}>{op.name}</span>
              </td>
              <td style={cell} title={op.city}>
                <span style={truncate}>{op.city || "-"}</span>
              </td>
              <td style={cell} title={op.parentContainerName}>
                <span style={truncate}>{op.parentContainerId ? op.parentContainerName || "-" : "-"}</span>
              </td>
              <td style={cell}>
                {op.canonical.instagram && (
                  <a href={op.canonical.instagram} target="_blank" rel="noreferrer">
                    IG
                  </a>
                )}
              </td>
              <td style={cell}>
                {op.canonical.booking && (
                  <a href={op.canonical.booking} target="_blank" rel="noreferrer">
                    Book
                  </a>
                )}
              </td>
              <td style={cell}>
                <span
                  style={{
                    color:
                      op.resolverStatus === "hot"
                        ? "green"
                        : op.resolverStatus === "enriched"
                          ? "#2255cc"
                          : op.resolverStatus === "shelved"
                            ? "orange"
                            : "gray",
                  }}
                >
                  {op.resolverStatus}
                </span>
              </td>
              <td style={cell} title={getReviewStateOrDefault(op.reviewState)}>
                <span style={truncate}>{getReviewStateOrDefault(op.reviewState)}</span>
              </td>
              <td style={cell}>{op.confidenceScore}</td>
              <td style={cell} title={outreach.preferredChannel}>
                <span style={truncate}>{outreach.preferredChannel}</span>
              </td>
              <td style={cell}>{outreach.eligible ? "ready" : "blocked"}</td>
              <td style={cell} title={outreach.reason}>
                <span style={truncate}>{outreach.reason}</span>
              </td>
              <td style={cell}>{op.evidenceCount}</td>
              <td style={{ ...cell, color: "#555" }} title={op.sourceTypeSummary || sourceTypeLabel(op)}>
                <span style={truncate}>{op.sourceTypeSummary || sourceTypeLabel(op)}</span>
              </td>
              <td style={cell}>
                {op.resolverStatus === "hot" ? (
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
              <td style={{ ...cell, fontSize: 11 }}>
                <details>
                  <summary style={{ cursor: "pointer" }}>expand ({evidenceCount(op)})</summary>
                  <div style={{ marginTop: 6, maxHeight: 220, overflowY: "auto", border: "1px solid #eee", padding: 6 }}>
                    {(op.evidence || []).map((row, idx) => {
                      const raw = row.raw && typeof row.raw === "object" ? (row.raw as Record<string, unknown>) : undefined;
                      const promotionMethod = raw && "promotionMethod" in raw ? String(raw.promotionMethod || "") : undefined;
                      const createdAt = raw && "createdAt" in raw ? Number(raw.createdAt || 0) : 0;
                      return (
                        <div key={`${op.id}-evidence-${idx}`} style={{ borderBottom: "1px solid #f0f0f0", padding: "4px 0" }}>
                          <div><strong>source:</strong> {row.source}</div>
                          <div><strong>url:</strong> {row.sourceUrl || "-"}</div>
                          <div><strong>type:</strong> {row.evidenceType || "-"}</div>
                          <div><strong>promotionMethod:</strong> {promotionMethod || "-"}</div>
                          <div><strong>timestamp:</strong> {createdAt ? new Date(createdAt).toISOString() : op.lastUpdatedAt}</div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
        </div>
      </div>
    </main>
  );
}
