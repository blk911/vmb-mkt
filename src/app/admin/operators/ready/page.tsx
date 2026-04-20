import fs from "node:fs";
import path from "node:path";
import { loadResolverBackedOperatorsWithReview } from "@/lib/operators/review-store";
import { loadReadyCoreSourceOperators, selectReadyCoreOperators } from "@/lib/operators/ready-core";
import { READY_CORE_EXPORT_CSV_ARTIFACT, READY_CORE_EXPORT_JSON_ARTIFACT } from "@/lib/operators/ready-export";
import type { OperatorRecord } from "@/lib/operators/types";

function loadOperators(): OperatorRecord[] {
  const resolverPath = path.join(process.cwd(), "runtime-data/resolver_registry.v1.json");
  if (!fs.existsSync(resolverPath)) return [];
  // keep ready-core sourcing aligned with resolver registry as system-of-record
  const source = loadReadyCoreSourceOperators();
  if (source.length > 0) return source;
  return loadResolverBackedOperatorsWithReview();
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

export default function OperatorsReadyPage({
  searchParams,
}: {
  searchParams?: {
    city?: string;
    category?: string;
    surface?: string;
    businessType?: string;
  };
}) {
  const readyAll = selectReadyCoreOperators(loadOperators());
  const withBooking = readyAll.filter((op) => Boolean(op.canonical.booking)).length;
  const withInstagram = readyAll.filter((op) => Boolean(op.canonical.instagram)).length;
  const byCategory = topCounts(readyAll.map((op) => op.normalizedCategory));
  const byCity = topCounts(readyAll.map((op) => op.city || "unknown"));
  const byBusinessType = topCounts(readyAll.map((op) => op.businessType || "unknown"));
  const byPreferredSurface = topCounts(readyAll.map((op) => op.preferredContactSurface || "none"));

  const cityOptions = [...new Set(readyAll.map((op) => op.city || "unknown"))].sort();
  const categoryOptions = [...new Set(readyAll.map((op) => op.normalizedCategory || "unknown"))].sort();
  const surfaceOptions = [...new Set(readyAll.map((op) => op.preferredContactSurface || "none"))].sort();
  const businessTypeOptions = [...new Set(readyAll.map((op) => op.businessType || "unknown"))].sort();

  const cityFilter = searchParams?.city || "";
  const categoryFilter = searchParams?.category || "";
  const surfaceFilter = searchParams?.surface || "";
  const businessTypeFilter = searchParams?.businessType || "";
  const ready = readyAll.filter((op) => {
    if (cityFilter && (op.city || "unknown") !== cityFilter) return false;
    if (categoryFilter && (op.normalizedCategory || "unknown") !== categoryFilter) return false;
    if (surfaceFilter && (op.preferredContactSurface || "none") !== surfaceFilter) return false;
    if (businessTypeFilter && (op.businessType || "unknown") !== businessTypeFilter) return false;
    return true;
  });

  return (
    <main style={{ minHeight: "100vh", background: "#fafafa" }}>
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Ready Core Workspace</h1>
        <div style={{ marginTop: 10 }}>
          <a href="/admin/operators">Back to Operator Console</a>
        </div>

        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: "10px 16px", fontSize: 13 }}>
        <span>
          <strong>Total ready:</strong> {readyAll.length}
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
        <span>
          <strong>By business type:</strong> {byBusinessType.map((x) => `${x.label} (${x.count})`).join(", ")}
        </span>
        <span>
          <strong>By preferred surface:</strong> {byPreferredSurface.map((x) => `${x.label} (${x.count})`).join(", ")}
        </span>
        </div>

        <form method="get" style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10, fontSize: 13 }}>
        <label>
          <strong>City:</strong>{" "}
          <select name="city" defaultValue={cityFilter}>
            <option value="">all</option>
            {cityOptions.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label>
          <strong>Category:</strong>{" "}
          <select name="category" defaultValue={categoryFilter}>
            <option value="">all</option>
            {categoryOptions.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label>
          <strong>Preferred surface:</strong>{" "}
          <select name="surface" defaultValue={surfaceFilter}>
            <option value="">all</option>
            {surfaceOptions.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label>
          <strong>Business type:</strong>{" "}
          <select name="businessType" defaultValue={businessTypeFilter}>
            <option value="">all</option>
            {businessTypeOptions.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Apply</button>
        <a href="/admin/operators/ready">Reset</a>
        </form>

        <div style={{ marginTop: 12, fontSize: 13 }}>
        <div>
          <strong>JSON export:</strong> <code>{READY_CORE_EXPORT_JSON_ARTIFACT}</code>
        </div>
        <div>
          <strong>CSV export:</strong> <code>{READY_CORE_EXPORT_CSV_ARTIFACT}</code>
        </div>
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
            <th align="left">Business type</th>
            <th align="left">Preferred contact surface</th>
            <th>Booking</th>
            <th>IG</th>
            <th>Website</th>
            <th>Contact QA</th>
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
              <td>{op.businessType}</td>
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
              <td>{!op.canonical.booking && !op.canonical.instagram ? "weak contact" : "-"}</td>
              <td>{op.reviewNotes || "-"}</td>
              <td>{evidenceCount(op)}</td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </main>
  );
}

