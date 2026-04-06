import fs from "node:fs";
import path from "node:path";

type Operator = {
  id: string;
  name: string;
  city?: string;
  canonical: {
    instagram?: string;
    booking?: string;
    website?: string;
  };
  status: "hot" | "shelved" | "discard";
  confidenceScore: number;
};

function loadOperators(): Operator[] {
  const filePath = path.join(process.cwd(), "runtime-data/operator_master.v1.json");
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export default function OperatorsPage() {
  const operators = loadOperators();
  const hot = operators.filter((o) => o.status === "hot");
  const shelved = operators.filter((o) => o.status === "shelved");

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
          </tr>
        </thead>
        <tbody>
          {operators.map((op) => (
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
