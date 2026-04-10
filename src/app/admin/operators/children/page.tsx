import { loadOperatorsFromResolverRegistry, type OperatorConsoleRow } from "@/lib/operators/loadOperators";
import { AdminTopNav } from "@/components/admin/AdminTopNav";

function statusRank(value: OperatorConsoleRow["resolverStatus"]): number {
  if (value === "hot") return 0;
  if (value === "enriched") return 1;
  if (value === "ready") return 2;
  if (value === "enumerated") return 3;
  return 4;
}

function childRank(value: OperatorConsoleRow["childState"]): number {
  if (value === "resolved_child") return 0;
  if (value === "provisional_child") return 1;
  return 2;
}

function topCounts(values: string[]): Array<{ label: string; count: number }> {
  const map = new Map<string, number>();
  for (const value of values) {
    const key = value.trim() || "unknown";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
}

function readPromotionMethod(row: OperatorConsoleRow["evidence"][number]): string | undefined {
  if (!row.raw || typeof row.raw !== "object") return undefined;
  const raw = row.raw as Record<string, unknown>;
  return raw.promotionMethod ? String(raw.promotionMethod) : undefined;
}

function readTimestamp(row: OperatorConsoleRow["evidence"][number], fallback: string): string {
  if (!row.raw || typeof row.raw !== "object") return fallback;
  const raw = row.raw as Record<string, unknown>;
  const value = Number(raw.createdAt || 0);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return new Date(value).toISOString();
}

function readInternalDetailLinks(row: OperatorConsoleRow["evidence"][number]): string[] {
  if (!row.extracted || typeof row.extracted !== "object") return [];
  const extracted = row.extracted as Record<string, unknown>;
  const links = extracted.internalDetailLinks;
  if (!Array.isArray(links)) return [];
  return links.filter((x): x is string => typeof x === "string");
}

export default function ChildOperatorsPage() {
  const allRows = loadOperatorsFromResolverRegistry();
  const childRows = allRows
    .filter((row) => row.operatorType === "child_operator" || Boolean(row.parentContainerId))
    .sort((a, b) => {
      const byChildState = childRank(a.childState) - childRank(b.childState);
      if (byChildState !== 0) return byChildState;
      const byStatus = statusRank(a.resolverStatus) - statusRank(b.resolverStatus);
      if (byStatus !== 0) return byStatus;
      if (a.evidenceCount !== b.evidenceCount) return b.evidenceCount - a.evidenceCount;
      return (a.name || "").localeCompare(b.name || "");
    });

  const byParent = topCounts(childRows.map((row) => row.parentContainerName || "unknown"));
  const provisionalCount = childRows.filter((row) => row.childState === "provisional_child").length;
  const resolvedCount = childRows.filter((row) => row.childState === "resolved_child").length;
  const withBooking = childRows.filter((row) => Boolean(row.canonical.booking)).length;
  const withInstagram = childRows.filter((row) => Boolean(row.canonical.instagram)).length;
  const withWebsite = childRows.filter((row) => Boolean(row.canonical.website)).length;

  return (
    <main style={{ minHeight: "100vh", background: "#fafafa" }}>
      <AdminTopNav />
      <div style={{ padding: "18px 20px", maxWidth: 1400 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Child Operators</h1>
        <div style={{ marginTop: 8, display: "flex", gap: 12, fontSize: 13 }}>
          <a href="/admin/operators">Operators</a>
          <a href="/admin/operators/children">Children</a>
          <a href="/admin/operators/ready">Ready</a>
          <a href="/admin/operators/surface-recovery">Surface Recovery</a>
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 13,
            color: "#333",
            display: "flex",
            flexWrap: "wrap",
            gap: "10px 16px",
          }}
        >
        <span>
          <strong>Total child operators:</strong> {childRows.length}
        </span>
        <span>
          <strong>Provisional child:</strong> {provisionalCount}
        </span>
        <span>
          <strong>Resolved child:</strong> {resolvedCount}
        </span>
        <span>
          <strong>With booking:</strong> {withBooking}
        </span>
        <span>
          <strong>With instagram:</strong> {withInstagram}
        </span>
        <span>
          <strong>With website:</strong> {withWebsite}
        </span>
        <span>
          <strong>By parent container:</strong>{" "}
          {byParent
            .slice(0, 8)
            .map((row) => `${row.label} (${row.count})`)
            .join(", ")}
        </span>
        </div>

        <div style={{ width: "100%", overflowX: "auto", marginTop: 20 }}>
        <table
          style={{
            width: "100%",
            minWidth: 1500,
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr>
              <th align="left" style={{ width: "16%" }}>Name</th>
              <th align="left" style={{ width: "8%" }}>City</th>
              <th align="left" style={{ width: "12%" }}>Parent Container</th>
              <th align="left" style={{ width: "8%" }}>Child State</th>
              <th align="left" style={{ width: "8%" }}>Status</th>
              <th align="left" style={{ width: "7%" }}>Booking</th>
              <th align="left" style={{ width: "7%" }}>IG</th>
              <th align="left" style={{ width: "7%" }}>Website</th>
              <th align="left" style={{ width: "6%" }}>Evidence</th>
              <th align="left" style={{ width: "11%" }}>Source Types</th>
              <th align="left" style={{ width: "18%" }}>Lineage / Evidence</th>
            </tr>
          </thead>
          <tbody>
            {childRows.map((row) => (
              <tr key={row.id} style={{ borderTop: "1px solid #eee", fontSize: 12, verticalAlign: "top" }}>
                <td style={{ padding: "8px 6px" }}>{row.name}</td>
                <td style={{ padding: "8px 6px" }}>{row.city || "-"}</td>
                <td style={{ padding: "8px 6px" }}>{row.parentContainerName || "-"}</td>
                <td style={{ padding: "8px 6px" }}>{row.childState}</td>
                <td style={{ padding: "8px 6px" }}>{row.resolverStatus}</td>
                <td style={{ padding: "8px 6px" }}>
                  {row.canonical.booking ? (
                    <a href={row.canonical.booking} target="_blank" rel="noreferrer">
                      Book
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td style={{ padding: "8px 6px" }}>
                  {row.canonical.instagram ? (
                    <a href={row.canonical.instagram} target="_blank" rel="noreferrer">
                      IG
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td style={{ padding: "8px 6px" }}>
                  {row.canonical.website ? (
                    <a href={row.canonical.website} target="_blank" rel="noreferrer">
                      Site
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td style={{ padding: "8px 6px" }}>{row.evidenceCount}</td>
                <td style={{ padding: "8px 6px" }}>{row.sourceTypeSummary || "-"}</td>
                <td style={{ padding: "8px 6px", fontSize: 11 }}>
                  <details>
                    <summary style={{ cursor: "pointer" }}>expand ({row.evidenceCount})</summary>
                    <div style={{ marginTop: 6, maxHeight: 260, overflowY: "auto", border: "1px solid #eee", padding: 6 }}>
                      {(row.evidence || []).map((evidenceRow, idx) => {
                        const internalLinks = readInternalDetailLinks(evidenceRow);
                        return (
                          <div key={`${row.id}-lineage-${idx}`} style={{ borderBottom: "1px solid #f0f0f0", padding: "4px 0" }}>
                            <div><strong>source:</strong> {evidenceRow.source}</div>
                            <div><strong>url:</strong> {evidenceRow.sourceUrl || "-"}</div>
                            <div><strong>type:</strong> {evidenceRow.evidenceType || "-"}</div>
                            <div><strong>promotionMethod:</strong> {readPromotionMethod(evidenceRow) || "-"}</div>
                            <div><strong>timestamp:</strong> {readTimestamp(evidenceRow, row.lastUpdatedAt)}</div>
                            <div><strong>parent hint:</strong> {evidenceRow.parentContainerName || row.parentContainerName || "-"}</div>
                            <div>
                              <strong>internal detail links:</strong>{" "}
                              {internalLinks.length ? internalLinks.slice(0, 3).join(" | ") : "-"}
                            </div>
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
