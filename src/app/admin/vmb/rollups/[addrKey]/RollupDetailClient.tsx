"use client";

import React from "react";
import Link from "next/link";

type ApiResp = {
  ok: boolean;
  addrKey: string;
  row: any | null;
  techs: any[];
  candidates: any[];
  error?: string;
};

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}
function s(v: any) {
  return (v ?? "").toString();
}

export default function RollupDetailClient({ addrKey }: { addrKey: string }) {
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [data, setData] = React.useState<ApiResp | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(
          `/api/admin/vmb/rollups/${encodeURIComponent(addrKey)}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          const t = await res.text();
          throw new Error(`detail api ${res.status}: ${t.slice(0, 160)}`);
        }

        const j = (await res.json()) as ApiResp;
        if (!alive) return;

        if (!j.ok) throw new Error(j.error || "detail api error");
        setData(j);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "fetch error");
        setData(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [addrKey]);

  const row = data?.row;

  return (
    <div className="p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm opacity-70">
            <Link href="/admin/vmb/rollups" className="underline">
              &lt;- Back to Rollups
            </Link>
          </div>
          <h1 className="text-[22px] font-black">{addrKey}</h1>
          <div className="text-sm opacity-70">
            Drilldown: rollup summary + top attached techs + candidates.
          </div>
        </div>
      </div>

      {loading && <div className="mt-4">Loading...</div>}
      {err && <div className="mt-4 text-red-600 font-semibold">{err}</div>}

      {!loading && !err && (
        <>
          <div className="mt-4 border border-neutral-200 rounded-2xl p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="REG" value={n(row?.regCount)} />
              <Kpi label="Tech" value={n(row?.attachedTechCount)} />
              <Kpi
                label="Tech/REG"
                value={
                  n(row?.regCount) > 0
                    ? (n(row?.attachedTechCount) / n(row?.regCount)).toFixed(2)
                    : "--"
                }
              />
              <Kpi label="Candidates" value={n(row?.candidatesCount)} />
            </div>

            <div className="mt-3 text-xs opacity-70">
              Seg: <b>{s(row?.segment || "--")}</b> - City:{" "}
              <b>{s(row?.city || "--")}</b> - State: <b>{s(row?.state || "--")}</b>
            </div>

            <div className="mt-3 text-xs opacity-70">
              Primary REG: <b>{s(row?.primaryRegLicenseNumber || "--")}</b>
              {Array.isArray(row?.regLicenseNumbers) &&
                row.regLicenseNumbers.length > 0 && (
                  <>
                    <span className="mx-2">-</span>
                    Sample REG nums:{" "}
                    <code className="text-xs">
                      {row.regLicenseNumbers.slice(0, 8).join(", ")}
                    </code>
                  </>
                )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Panel title={`Attached techs (top ${data?.techs?.length || 0})`}>
              <MiniTable
                rows={data?.techs || []}
                cols={[
                  ["License Type", "License Type"],
                  ["Formatted Name", "Formatted Name"],
                  ["City", "City"],
                  ["Mail Zip Code", "Mail Zip Code"],
                  ["License Status Description", "License Status Description"],
                ]}
              />
            </Panel>

            <Panel title={`Candidates (top ${data?.candidates?.length || 0})`}>
              <MiniTable
                rows={data?.candidates || []}
                cols={[
                  ["License Type", "License Type"],
                  ["Formatted Name", "Formatted Name"],
                  ["City", "City"],
                  ["State", "State"],
                  ["Mail Zip Code", "Mail Zip Code"],
                ]}
              />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: any }) {
  return (
    <div className="border border-neutral-200 rounded-xl p-3">
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-lg font-black">{value}</div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-neutral-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-100 font-extrabold">
        {title}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function MiniTable({
  rows,
  cols,
}: {
  rows: any[];
  cols: [string, string][];
}) {
  if (!rows?.length) return <div className="text-sm opacity-70">None.</div>;

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse">
        <thead className="bg-neutral-50 text-left">
          <tr className="text-xs opacity-80">
            {cols.map(([k]) => (
              <th key={k} className="px-2 py-2">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((r, i) => (
            <tr key={i} className="border-t border-neutral-100">
              {cols.map(([k, field]) => (
                <td key={k} className="px-2 py-2 text-xs">
                  {String(r?.[field] ?? "") || "--"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length > 50 && (
        <div className="text-xs opacity-70 mt-2">
          Showing first 50 (API returns up to 200).
        </div>
      )}
    </div>
  );
}
