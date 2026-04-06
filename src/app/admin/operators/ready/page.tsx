import fs from "node:fs";
import path from "node:path";
import { applyReviewOverlay } from "@/lib/operators/review-store";
import { selectReadyCoreOperators } from "@/lib/operators/ready-core";
import type { OperatorRecord } from "@/lib/operators/types";

function loadOperators(): OperatorRecord[] {
  const filePath = path.join(process.cwd(), "runtime-data/operator_master.v1.json");
  if (!fs.existsSync(filePath)) return [];
  const rows = JSON.parse(fs.readFileSync(filePath, "utf-8")) as OperatorRecord[];
  return applyReviewOverlay(rows);
}

function evidenceCount(op: OperatorRecord): number {
  return Array.isArray(op.evidence) ? op.evidence.length : 0;
}

function topCounts(values: string[]): Array<{ label: string; count: number }> {
  const map = new Map<string, number>();
  for (const value of values) {
    const key = value.trim();
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}

export default function OperatorsReadyPage() {
  const ready = selectReadyCoreOperators(loadOperators());
  const withBooking = ready.filter((op) => Boolean(op.canonical.booking)).length;
  const withInstagram = ready.filter((op) => Boolean(op.canonical.instagram)).length;
  const byCategory = topCounts(ready.map((op) => op.normalizedCategory));
  const byCity = topCounts(ready.map((op) => op.city || "unknown"));

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600 }}>Ready Core Workspace</h1>
      <div style={{ marginTop: 10 }}>
        <a href="/admin/operators">Back to Operator Console</a>
      </div>

      <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: "10px 16px", fontSize: 13 }}>
        <span>
          <strong>Total ready:</strong> {ready.length}
        </span>
        <span>
          <strong>With booking:</strong> {withBooking}
        </span>
        <span>
          <strong>With instagram:</strong> {withInstagram}
        </span>
        <span>
          <strong>By category:</strong> {byCategory.map((x) => `${x.label} (${x.count})`).join(", ")}
        </span>
        <span>
          <strong>By city:</strong> {byCity.map((x) => `${x.label} (${x.count})`).join(", ")}
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
            <th align="left">Category</th>
            <th align="left">Preferred contact surface</th>
            <th>Booking</th>
            <th>IG</th>
            <th>Website</th>
            <th align="left">Review notes</th>
            <th>Evidence count</th>
          </tr>
        </thead>
        <tbody>
          {ready.map((op) => (
            <tr key={op.id} style={{ borderTop: "1px solid #eee" }}>
              <td>{op.name}</td>
              <td>{op.city || "-"}</td>
              <td>{op.normalizedCategory}</td>
              <td>{op.preferredContactSurface}</td>
              <td>
                {op.canonical.booking ? (
                  <a href={op.canonical.booking} target="_blank" rel="noreferrer">
                    Booking
                  </a>
                ) : (
                  "-"
                )}
              </td>
              <td>
                {op.canonical.instagram ? (
                  <a href={op.canonical.instagram} target="_blank" rel="noreferrer">
                    IG
                  </a>
                ) : (
                  "-"
                )}
              </td>
              <td>
                {op.canonical.website ? (
                  <a href={op.canonical.website} target="_blank" rel="noreferrer">
                    Website
                  </a>
                ) : (
                  "-"
                )}
              </td>
              <td>{op.reviewNotes || "-"}</td>
              <td>{evidenceCount(op)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

