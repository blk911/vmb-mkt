"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useDashboardActions } from "../DashboardShell";
import styles from "./TargetsUI.module.css";

type Tech = {
  id: string;
  addressKey: string;
  displayName: string;
  address?: { street?: string; city?: string; state?: string; zip?: string };
  premise?: {
    types?: string[];
    phone?: string | null;
    website?: string | null;
    matchScore?: number;
    center?: {
      inCenter?: boolean;
      centerName?: string | null;
      centerPlaceId?: string | null;
      centerSource?: "containingPlaces" | "addressDescriptor" | "none";
    };
  };
};

type TechIndexResp = {
  ok: boolean;
  tech?: Tech[];
  updatedAt?: string;
  source?: { rows?: number; uniqAddressKey?: number };
};

type TargetList = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  filters?: any;
  techIds: string[];
  notes?: string;
};

async function apiGetLists(): Promise<TargetList[]> {
  const res = await fetch("/api/targets/lists", { cache: "no-store" });
  const j = await res.json();
  return (j?.lists || []) as TargetList[];
}

async function apiPost(body: any): Promise<any> {
  const res = await fetch("/api/targets/lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return await res.json();
}
function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

type SalonTier =
  | "ALL"
  | "25+"
  | "13-24"
  | "8-12"
  | "7"
  | "4-6"
  | "2-3"
  | "1";

function salonTierLabel(t: SalonTier) {
  switch (t) {
    case "25+":
      return "Mega Hub (25+)";
    case "13-24":
      return "Big Hub (13–24)";
    case "8-12":
      return "Mid Hub (8–12)";
    case "7":
      return "Large Salon (7)";
    case "4-6":
      return "Standard Salon (4–6)";
    case "2-3":
      return "Small Salon (2–3)";
    case "1":
      return "Indie Tech (1)";
    default:
      return "ALL";
  }
}

function tierFromCount(n: number): Exclude<SalonTier, "ALL"> {
  if (n >= 25) return "25+";
  if (n >= 13) return "13-24";
  if (n >= 8) return "8-12";
  if (n === 7) return "7";
  if (n >= 4) return "4-6";
  if (n >= 2) return "2-3";
  return "1";
}

function getSalonTier(row: any): Exclude<SalonTier, "ALL"> {
  if (row?.tier === "2-3" || row?.tier === "4-6" || row?.tier === "7") return row.tier;
  const techCount =
    Number(row?.techSignals?.techCountLicenses ?? row?.techSignals?.doraLicenses ?? 0) || 0;
  return tierFromCount(techCount);
}

function getCounts(row: any) {
  if (row?.counts) {
    return {
      total: Number(row.counts.total ?? 0) || 0,
      active: Number(row.counts.active ?? 0) || 0,
      unique: Number(row.counts.uniqueNames ?? 0) || 0,
      ratio: Number(row.activeRatio ?? 0) || 0,
    };
  }

  return {
    total: Number(row?.techSignals?.techCountLicenses ?? row?.techSignals?.doraLicenses ?? 0) || 0,
    active: row?.techSignals?.active != null ? Number(row.techSignals.active) || 0 : null,
    unique: row?.techSignals?.uniqueNames != null ? Number(row.techSignals.uniqueNames) || 0 : null,
    ratio: null,
  };
}

const getTechCountLicenses = (t: any) =>
  Number(t?.techSignals?.techCountLicenses ?? t?.techSignals?.doraLicenses ?? 0) || 0;

const getTechCountUnique = (t: any) =>
  Number(t?.techSignals?.techCountUnique ?? t?.rosterSummary?.uniqueNames ?? 0) || 0;

function isAptCondoPoi(t: any) {
  const place = t?.places?.best || {};
  const types: string[] = (((t?.premise?.types || place?.types || []) as any[]) || []).map((x: any) =>
    String(x || "").toLowerCase()
  );
  const aptType = types.some((x) => x.startsWith("apartment_") || x === "real_estate_agency");
  const placeName = String(place?.name || t?.placeName || "").toLowerCase();
  const aptName = placeName.includes("apartments") || placeName.includes("apartment");
  return aptType || aptName;
}

export default function TargetsClient({ initialListId }: { initialListId?: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [dataset, setDataset] = useState<"v4" | "2to7">("v4");
  const [rows, setRows] = useState<any[]>([]);

  const [city, setCity] = useState<string>("ALL");
  const [zip, setZip] = useState<string>("ALL");
  const [salonTier, setSalonTier] = useState<SalonTier>("ALL");
  const [minDoraLicenses, setMinDoraLicenses] = useState<number>(0);
  const [sortMode, setSortMode] = useState<string>("dora_desc");
  const [onlyActiveList, setOnlyActiveList] = useState<boolean>(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [hasWebsite, setHasWebsite] = useState(false);
  const [inCenter, setInCenter] = useState<"ANY" | "YES" | "NO">("ANY");
  const [typeQuery, setTypeQuery] = useState("");
  const [q, setQ] = useState<string>("");

  const [lists, setLists] = useState<TargetList[]>([]);
  const [activeListId, setActiveListId] = useState<string>("");
  const activeList = useMemo(
    () => lists.find((l) => l.id === activeListId) || null,
    [lists, activeListId]
  );
  const { setActions, clearActions } = useDashboardActions();
  const [newListName, setNewListName] = useState("");
  const [selectedTech, setSelectedTech] = useState<any | null>(null);
  const [listsCollapsed, setListsCollapsed] = useState(false);
  const [sweepByAddressKey, setSweepByAddressKey] = useState<Record<string, any>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const url = dataset === "v4" ? "/api/derived/tech-index?lite=1" : "/api/dora/2to7-active";
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        if (dataset === "v4") {
          setRows((j?.tech || []) as Tech[]);
        } else {
          const normalized = (j?.rows || []).map((r: any) => {
            const c = getCounts(r);
            return {
              ...r,
              id: String(r?.id || r?.addressKey || ""),
              addressKey: String(r?.addressKey || ""),
              displayName: String(r?.topName || r?.address?.street || r?.addressKey || "").trim(),
              address: r?.address || {},
              techSignals: {
                ...(r?.techSignals || {}),
                techCountLicenses: c.total,
                doraLicenses: c.total,
                techCountUnique: c.unique,
                active: c.active,
                uniqueNames: c.unique,
              },
              rosterSummary: {
                ...(r?.rosterSummary || {}),
                total: c.total,
                active: c.active ?? 0,
                uniqueNames: c.unique,
              },
              premise: {
                ...(r?.premise || {}),
                types: Array.isArray(r?.licenseTypes) ? r.licenseTypes : [],
              },
              segment: r?.segment || "unknown",
              segmentConfidence: Number(r?.activeRatio ?? 0) || 0,
              segmentSignals: r?.segmentSignals || [],
            };
          });
          setRows(normalized);
        }
      } catch (e: any) {
        setErr(e?.message || "failed_to_load");
        setRows([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dataset]);

  useEffect(() => {
    setCity("ALL");
    setZip("ALL");
    setSalonTier("ALL");
    setMinDoraLicenses(0);
    setSortMode("dora_desc");
    setOnlyActiveList(false);
    setHasPhone(false);
    setHasWebsite(false);
    setInCenter("ANY");
    setTypeQuery("");
    setQ("");
    setSelectedTech(null);
  }, [dataset]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/places/sweep", { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        const rows = Array.isArray(j?.rows) ? j.rows : [];
        const byAk: Record<string, any> = {};
        for (const r of rows) {
          const ak = String(r?.addressKey || "");
          if (ak) byAk[ak] = r;
        }
        setSweepByAddressKey(byAk);
      } catch {
        // optional enrichment surface; ignore failures
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const ls = await apiGetLists();
      setLists(ls);

      if (initialListId && ls.some((l) => l.id === initialListId)) {
        setActiveListId(initialListId);
        return;
      }

      if (!activeListId && ls.length) setActiveListId(ls[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeList) {
      clearActions();
      return;
    }

    setActions([
      {
        id: "export_csv",
        label: "Export CSV",
        onClick: () => {
          const url = `/api/targets/export?listId=${encodeURIComponent(activeList.id)}&format=csv`;
          window.location.href = url;
        },
        disabled: !activeList,
      },
      {
        id: "print",
        label: "Print",
        onClick: () => {
          window.open(
            `/dashboard/targets/print?listId=${encodeURIComponent(activeList.id)}`,
            "_blank"
          );
        },
        disabled: !activeList,
      },
    ]);

    // cleanup when leaving page
    return () => clearActions();
  }, [activeList, setActions, clearActions]);

  async function createListFromCurrentFilters() {
    const name = newListName.trim();
    if (!name) return;

    const filtersSnapshot = {
      city,
      zip,
      salonTier,
      hasPhone,
      hasWebsite,
      inCenter,
      typeQuery,
      minDoraLicenses,
      q,
    };

    const out = await apiPost({ op: "create", name, filters: filtersSnapshot });
    if (out?.ok && out?.list) {
      const ls = await apiGetLists();
      setLists(ls);
      setActiveListId(out.list.id);
      setNewListName("");
    }
  }

  const cities = useMemo(() => {
    const c = rows.map((t) => (t.address?.city || "UNKNOWN").toUpperCase());
    return ["ALL", ...uniq(c).sort()];
  }, [rows]);

  const zipsForCity = useMemo(() => {
    const filtered = city === "ALL"
      ? rows
      : rows.filter((t) => (t.address?.city || "UNKNOWN").toUpperCase() === city);

    const z = filtered.map((t) => (t.address?.zip || "00000").toString());
    return ["ALL", ...uniq(z).sort()];
  }, [rows, city]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return rows.filter((t) => {
      if (onlyActiveList) {
        const id = String((t as any).id || "");
        if (!activeList?.techIds?.includes(id)) return false;
      }

      const c = (t.address?.city || "UNKNOWN").toUpperCase();
      const z = (t.address?.zip || "00000").toString();
      if (city !== "ALL" && c !== city) return false;
      if (zip !== "ALL" && z !== zip) return false;
      if (salonTier !== "ALL") {
        const tier = getSalonTier(t);
        if (tier !== salonTier) return false;
      }
      const techCountLic = getTechCountLicenses(t);
      if (techCountLic < minDoraLicenses) return false;

      const phone = ((t as any).premise?.phone || (t as any).places?.best?.phone || "").toString().trim();
      const website = ((t as any).premise?.website || (t as any).places?.best?.website || "").toString().trim();
      const types = ((t as any).premise?.types || (t as any).places?.best?.types || []) as any[];
      const rowInCenter =
        (t as any)?.premise?.center?.inCenter === true ||
        (t as any)?.center?.inCenter === true;

      if (hasPhone && !phone) return false;
      if (hasWebsite && !website) return false;
      if (inCenter === "YES" && !rowInCenter) return false;
      if (inCenter === "NO" && rowInCenter) return false;

      const tq = typeQuery.trim().toLowerCase();
      if (tq) {
        const joined = (Array.isArray(types) ? types : []).map(String).join(" ").toLowerCase();
        if (!joined.includes(tq)) return false;
      }

      if (!qq) return true;
      const hay =
        `${t.displayName} ${t.addressKey} ${(t.premise?.types || []).join(" ")}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [rows, onlyActiveList, activeList, city, zip, salonTier, minDoraLicenses, hasPhone, hasWebsite, inCenter, typeQuery, q]);

  const sorted = useMemo(() => {
    const rows = filtered.slice();

    const getScore = (t: any) => Number(t?.places?.best?.score || t?.premise?.matchScore || 0) || 0;
    const getSeg = (t: any) => Number(t?.segmentConfidence || 0) || 0;
    const hasPhoneFn = (t: any) => !!String(t?.premise?.phone || t?.places?.best?.phone || "").trim();
    const hasWebFn = (t: any) => !!String(t?.premise?.website || t?.places?.best?.website || "").trim();

    rows.sort((a: any, b: any) => {
      if (sortMode === "place_score_desc") return getScore(b) - getScore(a) || getTechCountLicenses(b) - getTechCountLicenses(a);
      if (sortMode === "seg_conf_desc") return getSeg(b) - getSeg(a) || getTechCountLicenses(b) - getTechCountLicenses(a);
      if (sortMode === "has_phone_first") return Number(hasPhoneFn(b)) - Number(hasPhoneFn(a)) || getTechCountLicenses(b) - getTechCountLicenses(a);
      if (sortMode === "has_website_first") return Number(hasWebFn(b)) - Number(hasWebFn(a)) || getTechCountLicenses(b) - getTechCountLicenses(a);
      // default: tech count desc
      return getTechCountLicenses(b) - getTechCountLicenses(a) || getScore(b) - getScore(a);
    });

    return rows;
  }, [filtered, sortMode]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 16 }}>
        {/* LEFT: Lists */}
        <div
          style={{
            width: listsCollapsed ? 56 : 280,
            flex: `0 0 ${listsCollapsed ? 56 : 280}px`,
            borderRight: "1px solid rgba(0,0,0,0.08)",
            paddingRight: 12,
          }}
        >
          <button onClick={() => setListsCollapsed((v) => !v)} style={{ marginBottom: 10 }}>
            {listsCollapsed ? "»" : "«"}
          </button>
          {listsCollapsed ? (
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              <div style={{ fontWeight: 700 }}>Lists</div>
              <div>{lists.length}</div>
              {activeList ? <div style={{ marginTop: 6 }}>{activeList.techIds?.length || 0}</div> : null}
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Target Lists</div>

              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="New list name…"
                  style={{ flex: 1 }}
                />
                <button onClick={createListFromCurrentFilters}>Create</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {lists.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setActiveListId(l.id)}
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.10)",
                      background: l.id === activeListId ? "rgba(0,0,0,0.06)" : "white",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{l.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {l.techIds?.length || 0} targets
                    </div>
                  </button>
                ))}
                {!lists.length && (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    No lists yet. Create one from your current filters.
                  </div>
                )}
              </div>

              {activeList && (
                <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
                  <div style={{ fontWeight: 600, opacity: 0.95 }}>Active list</div>
                  <div>{activeList.name}</div>
                  <div>Targets: {activeList.techIds?.length || 0}</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* MIDDLE */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Targets — Tech First</h1>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              {loading ? "Loading…" : err ? `Error: ${err}` : `${filtered.length} / ${rows.length}`}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, marginBottom: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 700 }}>Dataset</label>
            <select
              className={styles.control}
              value={dataset}
              onChange={(e) => setDataset(e.target.value as "v4" | "2to7")}
              style={{ maxWidth: 260 }}
            >
              <option value="v4">Enriched (v4 Top 230)</option>
              <option value="2to7">2–7 Active First</option>
            </select>
          </div>

          <div className={styles.wrap}>
            <div className={styles.toolbar}>
              <div className={styles.toolbarGrid}>
                {/* SCOPE */}
                <div className={styles.sectionTitle}>Scope</div>
                <div className={styles.row}>
                  <div className={styles.field} style={{ minWidth: 160 }}>
                    <div className={styles.label}>City</div>
                    <select className={styles.control} value={city} onChange={(e) => { setCity(e.target.value); setZip("ALL"); }}>
                      {cities.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.field} style={{ minWidth: 140 }}>
                    <div className={styles.label}>Zip</div>
                    <select className={styles.control} value={zip} onChange={(e) => setZip(e.target.value)}>
                      {zipsForCity.map((z) => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.field} style={{ minWidth: 160 }}>
                    <div className={styles.label}>Salon Type</div>
                    <select
                      className={styles.control}
                      value={salonTier}
                      onChange={(e) => setSalonTier(e.target.value as SalonTier)}
                    >
                      <option value="ALL">ALL</option>
                      <option value="25+">{salonTierLabel("25+")}</option>
                      <option value="13-24">{salonTierLabel("13-24")}</option>
                      <option value="8-12">{salonTierLabel("8-12")}</option>
                      <option value="7">{salonTierLabel("7")}</option>
                      <option value="4-6">{salonTierLabel("4-6")}</option>
                      <option value="2-3">{salonTierLabel("2-3")}</option>
                      <option value="1">{salonTierLabel("1")}</option>
                    </select>
                  </div>

                  <div className={styles.field} style={{ minWidth: 120 }}>
                    <div className={styles.label}>Min Tech Count</div>
                    <input
                      className={styles.control}
                      type="number"
                      min={0}
                      value={minDoraLicenses}
                      onChange={(e) => setMinDoraLicenses(Number(e.target.value || 0))}
                    />
                  </div>

                  <div className={styles.field} style={{ minWidth: 210 }}>
                    <div className={styles.label}>Sort</div>
                    <select className={styles.control} value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
                      <option value="dora_desc">Tech Count (desc)</option>
                      <option value="place_score_desc">Place score (desc)</option>
                      <option value="seg_conf_desc">Segment confidence (desc)</option>
                      <option value="has_phone_first">Has phone first</option>
                      <option value="has_website_first">Has website first</option>
                    </select>
                  </div>
                </div>

                {/* SIGNALS */}
                <div className={styles.sectionTitle}>Signals</div>
                <div className={styles.row}>
                  <div className={styles.field} style={{ minWidth: 220 }}>
                    <div className={styles.label}>Type contains</div>
                    <input
                      className={styles.control}
                      value={typeQuery}
                      onChange={(e) => setTypeQuery(e.target.value)}
                      placeholder="nail, hair, beauty..."
                    />
                  </div>

                  <label className={styles.checkRow}>
                    <input type="checkbox" checked={hasPhone} onChange={(e) => setHasPhone(e.target.checked)} />
                    has phone
                  </label>

                  <label className={styles.checkRow}>
                    <input type="checkbox" checked={hasWebsite} onChange={(e) => setHasWebsite(e.target.checked)} />
                    has website
                  </label>

                  <div className={styles.field} style={{ minWidth: 150 }}>
                    <div className={styles.label}>In Center</div>
                    <select
                      className={styles.control}
                      value={inCenter}
                      onChange={(e) => setInCenter(e.target.value as "ANY" | "YES" | "NO")}
                    >
                      <option value="ANY">ANY</option>
                      <option value="YES">YES</option>
                      <option value="NO">NO</option>
                    </select>
                  </div>

                  <div className={styles.field} style={{ minWidth: 260 }}>
                    <div className={styles.label}>Search</div>
                    <input
                      className={styles.control}
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="name, address, type…"
                    />
                  </div>
                </div>

                {/* LIST OPS */}
                <div className={styles.sectionTitle}>List ops</div>
                <div className={styles.row}>
                  <label className={styles.checkRow} style={{ opacity: activeList ? 1 : 0.6 }}>
                    <input
                      type="checkbox"
                      checked={onlyActiveList}
                      onChange={(e) => setOnlyActiveList(e.target.checked)}
                      disabled={!activeList}
                    />
                    only active list
                  </label>

                  <button
                    className={styles.btn}
                    disabled={!activeList}
                    onClick={async () => {
                      if (!activeList) return;
                      const ids = sorted.map((t: any) => String(t.id)).filter(Boolean);
                      if (!ids.length) return;
                      await apiPost({ op: "addMany", id: activeList.id, techIds: ids });
                      const ls = await apiGetLists();
                      setLists(ls);
                    }}
                  >
                    Add all filtered
                  </button>

                  <button
                    className={styles.btn}
                    disabled={!activeList}
                    onClick={async () => {
                      if (!activeList) return;
                      const ids = sorted.map((t: any) => String(t.id)).filter(Boolean);
                      if (!ids.length) return;
                      await apiPost({ op: "removeMany", id: activeList.id, techIds: ids });
                      const ls = await apiGetLists();
                      setLists(ls);
                    }}
                  >
                    Remove all filtered
                  </button>
                </div>
              </div>

              <div className={styles.meta}>
                Showing <b>{sorted.length}</b> of <b>{rows.length}</b>
                {activeList ? (
                  <> · Active list: <b>{activeList.name}</b> ({activeList.techIds?.length || 0})</>
                ) : (
                  <> · No active list selected</>
                )}
              </div>
            </div>

            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
            {sorted.map((t) => {
              const inActiveList = !!activeList?.techIds?.includes((t as any).id);
              const counts = getCounts(t);
              const techCountLic = counts.total || getTechCountLicenses(t);
              const techCountUni = counts.unique ?? getTechCountUnique(t);
              const place = (t as any).places?.best || {};
              const sweep = sweepByAddressKey[String((t as any)?.addressKey || "")] || null;
              const effectiveClass = String(sweep?.effectiveAddressClass || sweep?.addressClass || "");
              const likelySuiteCenter =
                effectiveClass === "suite_center" && (Number(techCountLic || 0) >= 15 || Number(techCountUni || 0) >= 6);
              const facilityAccepted = !!sweep?.context?.hasAcceptedFacility;
              const aptCondoPoi = isAptCondoPoi(t);
              const centerName =
                (t as any)?.premise?.center?.centerName ||
                (t as any)?.center?.centerName ||
                "";
              const types: string[] = (((t as any).premise?.types || place.types || []) as any[]).map(String);
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTech(t)}
                  className={styles.card}
                  style={{ cursor: "pointer" }}
                >
                  <div className={styles.cardTop}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div className={styles.cardTitle}>{t.displayName}</div>
                      {inActiveList ? <span className={styles.badge}>✓ In list</span> : null}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div className={styles.badge}>
                        Tech Count: {techCountLic} · Unique: {techCountUni ?? 0}
                        {counts.active != null ? ` · Active: ${counts.active}` : ""}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTech(t);
                        }}
                      >
                        Details
                      </button>
                      <div className={styles.badge}>{t.address?.city?.toUpperCase()} {t.address?.zip}</div>
                    </div>
                  </div>

                  <div className={styles.cardSub}>{t.addressKey}</div>
                  <div className={styles.cardSub}>
                    Salon Type: {salonTierLabel(getSalonTier(t))} · conf: {Number((t as any).segmentConfidence || 0).toFixed(2)} · Places: {place?.name || "(none)"}
                  </div>
                  <div className={styles.chips}>
                    {aptCondoPoi ? <span className={styles.chip}>APT/CONDO POI</span> : null}
                    {likelySuiteCenter ? <span className={styles.chip}>LIKELY SUITE CENTER</span> : null}
                    {facilityAccepted ? <span className={styles.chip}>FACILITY ACCEPTED</span> : null}
                  </div>
                  {centerName ? (
                    <div className={styles.cardSub}>
                      Center: <b>{centerName}</b>
                    </div>
                  ) : null}

                  <div className={styles.chips}>
                    {(types.length ? types : ["(none)"]).slice(0, 6).map((x: string) => (
                      <span key={x} className={styles.chip}>
                        {x}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </div>

        {/* RIGHT: Drawer mount point */}
        <div style={{ width: 0 }} />
      </div>

      {selectedTech && (
        <div className={styles.drawerBackdrop} onClick={() => setSelectedTech(null)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            {(() => {
              const t: any = selectedTech;
              const counts = getCounts(t);
              const techCountLic = counts.total || getTechCountLicenses(t);
              const techCountUni = counts.unique ?? getTechCountUnique(t);
              const place = t.places?.best || {};
              const phone = (t.premise?.phone || place.phone || "").toString().trim();
              const website = (t.premise?.website || place.website || "").toString().trim();
              const centerName = t?.premise?.center?.centerName || t?.center?.centerName || "";
              const types: string[] = (t.premise?.types || place.types || []) as any[];
              const sweep = sweepByAddressKey[String(t?.addressKey || "")] || null;
              const effectiveClass = String(sweep?.effectiveAddressClass || sweep?.addressClass || "");
              const likelySuiteCenter =
                effectiveClass === "suite_center" && (Number(techCountLic || 0) >= 15 || Number(techCountUni || 0) >= 6);
              const facilityAccepted = !!sweep?.context?.hasAcceptedFacility;
              const aptCondoPoi = isAptCondoPoi(t);

              const inList = !!activeList?.techIds?.includes(t.id);

              async function addRemove() {
                if (!activeList) return;
                const op = inList ? "removeTech" : "addTech";
                const out = await apiPost({ op, id: activeList.id, techId: t.id });
                if (out?.ok) {
                  const ls = await apiGetLists();
                  setLists(ls);
                }
              }

              return (
                <>
                  <div className={styles.drawerHeader}>
                    <div>
                      <div className={styles.drawerTitle}>{t.displayName}</div>
                      <div className={styles.drawerSub}>{t.addressKey}</div>
                    </div>
                    <button className={styles.drawerClose} onClick={() => setSelectedTech(null)}>
                      Close
                    </button>
                  </div>

                  <div className={styles.pills}>
                    <span className={styles.pill}>
                      Salon Type: {salonTierLabel(getSalonTier(t))}
                    </span>
                    <span className={styles.pill}>Tech Count (Licenses): {techCountLic}</span>
                    <span className={styles.pill}>Tech Count (Unique): {techCountUni}</span>
                    {counts.active != null ? <span className={styles.pill}>Active: {counts.active}</span> : null}
                    {counts.ratio != null ? <span className={styles.pill}>Active ratio: {Number(counts.ratio || 0).toFixed(2)}</span> : null}
                    {place?.score ? <span className={styles.pill}>Places score: {Number(place.score).toFixed(0)}</span> : null}
                    {inList ? <span className={styles.pill}>✓ In active list</span> : null}
                    {aptCondoPoi ? <span className={styles.pill}>APT/CONDO POI</span> : null}
                    {likelySuiteCenter ? <span className={styles.pill}>LIKELY SUITE CENTER</span> : null}
                    {facilityAccepted ? <span className={styles.pill}>FACILITY ACCEPTED</span> : null}
                  </div>

                  <div className={styles.section}>
                    <div className={styles.sectionTitle2}>Premise</div>
                    <div className={styles.kv}>
                      <div className={styles.k}>Place</div>
                      <div className={styles.v}>{place?.name || "(none)"}</div>

                      <div className={styles.k}>Phone</div>
                      <div className={styles.v}>
                        {phone ? <a className={styles.link} href={`tel:${phone}`}>{phone}</a> : "(none)"}
                      </div>

                      <div className={styles.k}>Website</div>
                      <div className={styles.v}>
                        {website ? <a className={styles.link} href={website} target="_blank" rel="noreferrer">{website}</a> : "(none)"}
                      </div>

                      <div className={styles.k}>Center</div>
                      <div className={styles.v}>{centerName || "(none)"}</div>

                      <div className={styles.k}>Types</div>
                      <div className={styles.v}>
                        {types?.length ? (
                          <div className={styles.chips}>
                            {types.slice(0, 10).map((x) => (
                              <span key={x} className={styles.chip}>{x}</span>
                            ))}
                          </div>
                        ) : (
                          "(none)"
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles.section}>
                    <div className={styles.sectionTitle2}>DORA roster</div>
                    <div className={styles.kv}>
                      <div className={styles.k}>Total</div>
                      <div className={styles.v}>{t.rosterSummary?.total ?? techCountLic}</div>

                      <div className={styles.k}>Active</div>
                      <div className={styles.v}>{t.rosterSummary?.active ?? 0}</div>

                      <div className={styles.k}>Unique names</div>
                      <div className={styles.v}>{t.rosterSummary?.uniqueNames ?? techCountUni}</div>

                      <div className={styles.k}>License types</div>
                      <div className={styles.v}>
                        {(t.rosterLicenseTypes || []).slice(0, 12).join(", ") || "(none)"}
                      </div>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <div className={styles.k} style={{ marginBottom: 6 }}>Top names</div>
                      <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                        {(t.rosterNames?.topNames || []).slice(0, 10).map((x: any, i: number) => (
                          <div key={i} style={{ opacity: 0.92 }}>
                            {x.name} ({x.count})
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={styles.section}>
                    <div className={styles.sectionTitle2}>List actions</div>
                    {!activeList ? (
                      <div style={{ fontSize: 13, opacity: 0.75 }}>
                        Create/select a list on the left to add targets.
                      </div>
                    ) : (
                      <div className={styles.listActionsRow}>
                        <button className={styles.btn} onClick={addRemove}>
                          {inList ? "Remove from active list" : "Add to active list"}
                        </button>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                          Active: <b>{activeList.name}</b>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={styles.section}>
                    <div className={styles.sectionTitle2}>Why this salon type</div>
                    <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                      {(t.segmentSignals || []).map((s: string, i: number) => (
                        <div key={i} style={{ opacity: 0.9 }}>
                          • {s}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
