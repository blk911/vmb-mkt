import { loadOperatorsFromResolverRegistry } from "@/lib/operators/loadOperators";
import { selectSurfaceRecoveryQueue, writeSurfaceRecoveryQueue } from "@/lib/operators/surface-recovery";
import { AdminTopNav } from "@/components/admin/AdminTopNav";

function topCounts(values: string[]): Array<{ label: string; count: number }> {
  const map = new Map<string, number>();
  for (const value of values) {
    const key = value.trim() || "unknown";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
}

export default function SurfaceRecoveryPage() {
  const operators = loadOperatorsFromResolverRegistry();
  const queue = [...selectSurfaceRecoveryQueue(operators)].sort((a, b) => b.recoveryPriority - a.recoveryPriority);
  const artifactPath = (() => {
    try {
      return writeSurfaceRecoveryQueue(queue);
    } catch {
      return "runtime-data/operator_surface_recovery_queue.json";
    }
  })();
  const byStatus = topCounts(queue.map((x) => x.status));
  const byChildState = topCounts(queue.map((x) => x.childState));
  const bySourceMix = topCounts(queue.map((x) => x.sourceTypeSummary || "none"));

  return (
    <main style={{ minHeight: "100vh", background: "#fafafa" }}>
      <AdminTopNav />
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Surface Recovery Queue</h1>
        <div style={{ marginTop: 10 }}>
          <a href="/admin/operators">Back to Operator Console</a>
        </div>
        <div style={{ marginTop: 12, fontSize: 13, display: "flex", flexWrap: "wrap", gap: "10px 16px" }}>
        <span>
          <strong>Total queued:</strong> {queue.length}
        </span>
        <span>
          <strong>By status:</strong> {byStatus.map((x) => `${x.label} (${x.count})`).join(", ")}
        </span>
        <span>
          <strong>By childState:</strong> {byChildState.map((x) => `${x.label} (${x.count})`).join(", ")}
        </span>
        <span>
          <strong>By source mix:</strong> {bySourceMix.map((x) => `${x.label} (${x.count})`).join(", ")}
        </span>
        <span>
          <strong>Artifact:</strong> <code>{artifactPath}</code>
        </span>
        </div>

        <table style={{ width: "100%", marginTop: 20, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Name</th>
            <th align="left">City</th>
            <th align="left">Status</th>
            <th align="left">Child State</th>
            <th align="left">Evidence Count</th>
            <th align="left">Source Types</th>
            <th align="left">Recovery Priority</th>
            <th align="left">Review State</th>
            <th align="left">Notes</th>
          </tr>
        </thead>
        <tbody>
          {queue.map((row) => (
            <tr key={row.id} style={{ borderTop: "1px solid #eee" }}>
              <td>{row.name}</td>
              <td>{row.city || "-"}</td>
              <td>{row.status}</td>
              <td>{row.childState}</td>
              <td>{row.evidenceCount}</td>
              <td>{row.sourceTypeSummary || "-"}</td>
              <td>
                <div>{row.recoveryPriority}</div>
                <div style={{ fontSize: 11, color: "#666" }}>{row.recoveryReasons.slice(0, 4).join(" • ")}</div>
              </td>
              <td>{row.reviewState || "unreviewed"}</td>
              <td>{row.reviewNotes || "-"}</td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </main>
  );
}

