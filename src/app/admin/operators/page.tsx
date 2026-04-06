import fs from "node:fs";
import path from "node:path";
import type { OperatorRecord } from "@/lib/operators/types";
import { getOutreachEligibility } from "@/lib/operators/outreach-eligibility";
import OperatorOutreachPanel from "@/components/admin/operators/OperatorOutreachPanel";

function loadOperators(): OperatorRecord[] {
  const filePath = path.join(process.cwd(), "runtime-data/operator_master.v1.json");
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export default function OperatorsPage() {
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
  const hot = operators.filter(({ op }) => op.status === "hot");
  const shelved = operators.filter(({ op }) => op.status === "shelved");

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600 }}>Operator Console</h1>
      <div style={{ marginTop: 12 }}>
        <strong>Total:</strong> {operators.length} | <strong>Hot:</strong> {hot.length} | <strong>Shelved:</strong>{" "}
        {shelved.length}
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
            <th>Score</th>
            <th>Channel</th>
            <th>Outreach</th>
            <th>Reason</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {operators.map(({ op, outreach }) => (
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
              <td>{op.confidenceScore}</td>
              <td>{outreach.preferredChannel}</td>
              <td>{outreach.eligible ? "ready" : "blocked"}</td>
              <td>{outreach.reason}</td>
              <td>
                {outreach.eligible ? <OperatorOutreachPanel operatorId={op.id} /> : <span style={{ color: "#888" }}>not ready</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
