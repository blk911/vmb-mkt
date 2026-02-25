"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { tabPredicate, type RollupTab, DEFAULT_THRESHOLDS, type CityTruthRow, predicates } from "@/app/admin/_lib/truth-predicates";
import { ExplainModal } from "@/app/admin/_components/ExplainModal";

type TabKey =
  | "ALL"
  | "TECH_CLUSTERS"
  | "MID_MARKET_INDIE"
  | "MEGA_CITIES"
  | "CAND"
  | "CORP_AGG"
  | "FRANCHISE";

type SortKey = "tech" | "cand" | "reg" | "ratio" | "city";
type SortDir = "asc" | "desc";

function s(v: any) {
  return (v ?? "").toString().trim();
}
function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function techCount(r: CityTruthRow) {
  return n(r.techCount);
}
function candCount(r: CityTruthRow) {
  return n(r.candCount);
}
function regCount(r: CityTruthRow) {
  return n(r.regCount);
}
function techRegRatio(r: CityTruthRow) {
  // PATCH 4: Never show 9999. Use truth techPerReg or techCount if reg==0
  return r.regCount > 0 ? r.techPerReg : r.techCount;
}

function getParam(sp: URLSearchParams, key: string, fallback: string) {
  const v = sp.get(key);
  return v === null || v === "" ? fallback : v;
}

function setParams(
  router: ReturnType<typeof useRouter>,
  sp: URLSearchParams,
  patch: Record<string, string | null>
) {
  const next = new URLSearchParams(sp.toString());
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === "") next.delete(k);
    else next.set(k, v);
  }
  router.replace(`?${next.toString()}`);
}

export default function RollupsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const q0 = getParam(searchParams as any, "q", "");
  const tab0 = getParam(searchParams as any, "tab", "ALL") as TabKey;
  const sort0 = getParam(searchParams as any, "sort", "tech") as SortKey;
  const dir0 = getParam(searchParams as any, "dir", "desc") as SortDir;

  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<CityTruthRow[]>([]);
  const [explainOpen, setExplainOpen] = React.useState(false);
  const [explainCityKey, setExplainCityKey] = React.useState<string | null>(null);

  const [q, setQ] = React.useState(q0);
  const [tab, setTab] = React.useState<TabKey>(tab0);
  const [sortKey, setSortKey] = React.useState<SortKey>(sort0);
  const [sortDir, setSortDir] = React.useState<SortDir>(dir0);

  // PATCH 4: Fetch from truth city API
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch("/api/admin/dora/truth/city", { cache: "no-store" });

        if (!res.ok) {
          const t = await res.text();
          throw new Error(`truth city api ${res.status}: ${t.slice(0, 120)}`);
        }

        const j = await res.json();

        if (!alive) return;

        if (!j.ok) {
          setErr(j.error || "Failed to load truth rollups");
          setRows([]);
          return;
        }
        setRows(j.rows || []);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Fetch error");
        setRows([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Debounced URL sync for q
  React.useEffect(() => {
    const t = setTimeout(() => {
      setParams(router, searchParams as any, { q: q.trim() ? q.trim() : null });
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // URL sync for tab/sort/dir
  React.useEffect(() => {
    setParams(router, searchParams as any, {
      tab: tab === "ALL" ? null : tab,
      sort: sortKey === "tech" ? null : sortKey,
      dir: sortDir === "desc" ? null : sortDir,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, sortKey, sortDir]);

  // PATCH 4F: Tab counts computed directly from truth predicates
  const counts = React.useMemo(() => {
    return {
      all: rows.length,
      candidates: rows.filter(predicates.CANDIDATES).length,
      techClusters: rows.filter(predicates.TECH_CLUSTERS).length,
      midMarketIndie: rows.filter(predicates.MID_MARKET_INDIE).length,
      megaCities: rows.filter(predicates.MEGA_CITIES).length,
      corporateAggregators: 0,
      franchiseOwners: 0,
    };
  }, [rows]);

  // PATCH 4F: Filter using truth predicates
  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();

    // Apply active tab filter
    const activePredicate =
      tab === "CAND" ? predicates.CANDIDATES :
      tab === "TECH_CLUSTERS" ? predicates.TECH_CLUSTERS :
      tab === "MID_MARKET_INDIE" ? predicates.MID_MARKET_INDIE :
      tab === "MEGA_CITIES" ? predicates.MEGA_CITIES :
      tab === "CORP_AGG" ? predicates.CORPORATE_AGGREGATORS :
      tab === "FRANCHISE" ? predicates.FRANCHISE_OWNERS :
      predicates.ALL;

    return rows.filter((r) => {
      // Apply tab predicate
      if (!activePredicate(r)) return false;

      // Apply search filter
      if (!qq) return true;

      const hay = [
        r.cityLabel,
        r.cityKey,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(qq);
    });
  }, [rows, q, tab]);

  const sorted = React.useMemo(() => {
    const dirMul = sortDir === "asc" ? 1 : -1;

    function keyOf(r: CityTruthRow): number | string {
      switch (sortKey) {
        case "tech":
          return techCount(r);
        case "cand":
          return candCount(r);
        case "reg":
          return regCount(r);
        case "ratio":
          return techRegRatio(r);
        case "city":
          return s(r.cityLabel).toLowerCase();
        default:
          return techCount(r);
      }
    }

    const copy = [...filtered];
    copy.sort((a, b) => {
      const A = keyOf(a);
      const B = keyOf(b);

      // primary
      let cmp = 0;
      if (typeof A === "number" && typeof B === "number") cmp = (A - B) * dirMul;
      else cmp = String(A).localeCompare(String(B)) * dirMul;

      // stable tie-breakers (always deterministic)
      if (cmp !== 0) return cmp;

      const ac = s(a.cityLabel).toLowerCase();
      const bc = s(b.cityLabel).toLowerCase();
      const c2 = ac.localeCompare(bc);
      if (c2 !== 0) return c2;

      const ak = s(a.cityKey).toLowerCase();
      const bk = s(b.cityKey).toLowerCase();
      return ak.localeCompare(bk);
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const total = rows.length;
  const showing = sorted.length;

  return (
    <div className="p-6">
      <div className="flex items-end justify-between gap-4 mb-3">
        <div>
          <h1 className="text-[22px] font-black">Rollups</h1>
          <div className="text-sm opacity-70">
            PATCH 4: Truth-based rollups. City rollups computed from address truth. Tabs use predicates.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="px-3 py-2 rounded-xl border border-neutral-200 font-extrabold"
            onClick={() => {
              // Reset local state
              setQ("");
              setTab("ALL");
              setSortKey("tech");
              setSortDir("desc");

              // Reset URL
              const sp = new URLSearchParams(searchParams as any);
              sp.delete("q");
              sp.delete("tab");
              sp.delete("sort");
              sp.delete("dir");
              router.replace(`?${sp.toString()}`);
            }}
            title="Reset filters + sort"
          >
            Reset
          </button>

          <button
            className="px-4 py-2 rounded-xl bg-black text-white font-extrabold"
            onClick={() => alert("Save Target: wire next")}
          >
            Save Target
          </button>
        </div>
      </div>

      <div className="border border-neutral-200 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search: city, business, addressKey…"
            className="flex-1 min-w-[320px] px-3 py-2 rounded-xl border border-neutral-200"
          />

          <div className="flex items-center gap-2">
            <span className="text-xs opacity-70">Sort:</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="px-3 py-2 rounded-xl border border-neutral-200"
            >
              <option value="tech">Tech</option>
              <option value="reg">REG</option>
              <option value="ratio">Tech/REG</option>
              <option value="cand">Candidates</option>
              <option value="city">City</option>
            </select>

            <button
              className="px-3 py-2 rounded-xl border border-neutral-200"
              title="Toggle sort direction"
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            >
              {sortDir === "asc" ? "↑" : "↓"}
            </button>
          </div>

          <div className="ml-auto text-xs opacity-70">
            Showing <b>{showing}</b> of <b>{total}</b>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Pill active={tab === "ALL"} onClick={() => setTab("ALL")}>
            All <span className="opacity-70">({counts.all})</span>
          </Pill>

          <Pill active={tab === "TECH_CLUSTERS"} onClick={() => setTab("TECH_CLUSTERS")}>
            Tech clusters <span className="opacity-70">({counts.techClusters})</span>
          </Pill>

          <Pill active={tab === "MID_MARKET_INDIE"} onClick={() => setTab("MID_MARKET_INDIE")}>
            Mid-market Indie <span className="opacity-70">({counts.midMarketIndie})</span>
          </Pill>

          <Pill active={tab === "MEGA_CITIES"} onClick={() => setTab("MEGA_CITIES")}>
            Mega cities <span className="opacity-70">({counts.megaCities})</span>
          </Pill>

          <Pill active={tab === "CAND"} onClick={() => setTab("CAND")}>
            Candidates <span className="opacity-70">({counts.candidates})</span>
          </Pill>

          <Pill active={tab === "CORP_AGG"} onClick={() => setTab("CORP_AGG")} disabled>
            Corporate Aggregators <span className="opacity-70">({counts.corporateAggregators})</span>
          </Pill>

          <Pill active={tab === "FRANCHISE"} onClick={() => setTab("FRANCHISE")} disabled>
            Franchise Owners <span className="opacity-70">({counts.franchiseOwners})</span>
          </Pill>
        </div>

        <div className="mt-3 text-xs opacity-70">
          Mid-market Indie = tech {DEFAULT_THRESHOLDS.midMarketMinTech}–{DEFAULT_THRESHOLDS.midMarketMaxTech} & REG&gt;0. Mega cities = REG ≥ {DEFAULT_THRESHOLDS.megaCityMinReg}.
        </div>
      </div>

      <div className="mt-4">
        {loading && <div>Loading…</div>}
        {err && <div className="text-red-600 font-semibold">{err}</div>}

        {!loading && !err && (
          <div className="border border-neutral-200 rounded-2xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead className="bg-neutral-50 text-left">
                <tr className="text-xs opacity-80">
                  <Th>City</Th>
                  <Th>REG</Th>
                  <Th>Tech</Th>
                  <Th>Tech/REG</Th>
                  <Th>Cand</Th>
                  <Th>Addresses</Th>
                  <Th>Explain</Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, idx) => (
                  <tr
                    key={r.cityKey + ":" + idx}
                    className="border-t border-neutral-100 cursor-pointer hover:bg-neutral-50"
                    onClick={() =>
                      router.push(
                        `/admin/vmb/rollups/city/${encodeURIComponent(r.cityKey)}`
                      )
                    }
                    title="Open drilldown"
                  >
                    <Td className="font-extrabold">{s(r.cityLabel) || "—"}</Td>
                    <Td>{regCount(r)}</Td>
                    <Td>{techCount(r)}</Td>
                    <Td>
                      {r.regCount > 0
                        ? r.techPerReg.toFixed(2)
                        : r.techCount > 0
                        ? `${r.techCount} (no REG)`
                        : "0"}
                    </Td>
                    <Td>{candCount(r)}</Td>
                    <Td>{r.addrCount}</Td>
                    <Td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExplainCityKey(r.cityKey);
                          setExplainOpen(true);
                        }}
                        className="px-2 py-1 text-xs border border-neutral-200 rounded hover:bg-neutral-100"
                      >
                        Explain
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !err && sorted.length === 0 && (
          <div className="mt-2 opacity-70">No matches.</div>
        )}
      </div>

      {/* PATCH 4: Explain Modal */}
      <ExplainModal
        open={explainOpen}
        cityKey={explainCityKey}
        onClose={() => {
          setExplainOpen(false);
          setExplainCityKey(null);
        }}
      />
    </div>
  );
}

function Pill(props: {
  active?: boolean;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={props.disabled ? undefined : props.onClick}
      title={props.title}
      className={[
        "px-3 py-1.5 rounded-full border text-xs font-extrabold",
        props.disabled
          ? "bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed"
          : props.active
          ? "bg-black text-white border-black"
          : "bg-white text-black border-neutral-200",
      ].join(" ")}
      aria-disabled={props.disabled ? "true" : "false"}
    >
      {props.children}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2">{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2 text-sm ${className}`}>{children}</td>;
}
