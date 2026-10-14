"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { CatalogCoverage } from "@/lib/catalog/types";
import { filterCatalogRecords, normalizeCatalogFilters, sortCatalogRecords, catalogNeedsReview } from "@/lib/catalog/query";
import { profilePlatformLabels } from "@/lib/admin/pipeline/profile-presentation";
import CatalogDetail from "./CatalogDetail";
import CatalogResultRow, { catalogRowName } from "./CatalogResultRow";
import ListEditor from "./ListEditor";
import { EMPTY_FILTERS, dateLabel, listMemberIds, postList, readable, readJson, type CatalogFilters, type CatalogList, type CatalogRecord } from "./catalog-ui-types";
import styles from "./CatalogWorkspace.module.css";

type CatalogResponse = { rows: CatalogRecord[]; coverage?: CatalogCoverage; generatedAt?: string; viewer?: { canReview: boolean } };
type SortColumn = "name" | "platform" | "booking" | "social" | "provider" | "salon" | "service" | "area" | "city" | "postalCode" | "status";
const PAGE_SIZE = 30;
// Older saved links keep their sort even when the field is no longer a table column.
const SORT_COLUMNS: SortColumn[] = ["name", "platform", "booking", "social", "provider", "salon", "service", "area", "city", "postalCode", "status"];
const COLUMNS: Array<{ key: SortColumn; label: string; centered?: boolean }> = [
  { key: "name", label: "Provider / salon" }, { key: "platform", label: "Booking platform" },
  { key: "social", label: "IG / website", centered: true }, { key: "city", label: "City / State / ZIP" },
];

function normalizedFilters(value?: Partial<CatalogFilters>): CatalogFilters {
  const normalized = normalizeCatalogFilters(value);
  return Object.fromEntries(Object.entries(EMPTY_FILTERS).map(([key, fallback]) => [key, normalized[key as keyof typeof normalized] ?? fallback])) as CatalogFilters;
}

function message(failure: unknown) { return failure instanceof Error ? failure.message : "Something went wrong. Please retry."; }

export default function CatalogWorkspace({ initialView = "catalog", initialListId = "", title = "Prospects", admin = false }: { initialView?: "catalog" | "lists"; initialListId?: string; title?: string; admin?: boolean }) {
  const [catalog, setCatalog] = useState<CatalogResponse>({ rows: [] });
  const [lists, setLists] = useState<CatalogList[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [listError, setListError] = useState("");
  const [view, setView] = useState<"catalog" | "lists">(initialListId ? "lists" : initialView);
  const [activeId, setActiveId] = useState(initialListId);
  const [filters, setFilters] = useState<CatalogFilters>({ ...EMPTY_FILTERS });
  const [sort, setSort] = useState<SortColumn>("platform");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<CatalogRecord | null>(null);
  const [listQuery, setListQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [saveMode, setSaveMode] = useState<"fixed" | "dynamic" | null>(null);
  const [listView, setListView] = useState<"all" | "due" | "unassigned">("all");
  const [urlReady, setUrlReady] = useState(false);
  const mutationBusy = useRef(false);
  const urlFilterPreview = useRef(false);
  const [destinationId, setDestinationId] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reloadSequence = useRef(0);
  const reload = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++reloadSequence.current;
    setLoading(true);
    const [catalogResult, listResult] = await Promise.allSettled([
      readJson<CatalogResponse>("/api/catalog", { signal }), readJson<{ lists: CatalogList[] }>("/api/targets/lists", { signal }),
    ]);
    if (signal?.aborted || sequence !== reloadSequence.current) return;
    if (catalogResult.status === "fulfilled") { setCatalog(catalogResult.value); setCatalogError(""); }
    else setCatalogError(message(catalogResult.reason));
    if (listResult.status === "fulfilled") {
      setLists(listResult.value.lists);
      setListError("");
    } else setListError(message(listResult.reason));
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => { controller.abort(); reloadSequence.current += 1; };
  }, [reload]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function restore() {
      const currentUrl = new URL(window.location.href);
      const params = currentUrl.searchParams;
      urlFilterPreview.current = params.get("preview") === "1" || Object.keys(EMPTY_FILTERS).some((key) => params.has(key));
      setView(params.get("listId") || currentUrl.pathname.includes("/lists") ? "lists" : "catalog");
      setActiveId(params.get("listId") || "");
      setInitializedList("");
      try { setFilters(normalizedFilters(Object.fromEntries(params))); }
      catch { setFilters({ ...EMPTY_FILTERS }); setError("Some URL filters were invalid and have been cleared."); }
      const order = params.get("sort") as SortColumn;
      setSort(SORT_COLUMNS.includes(order) ? order : "platform");
      setDirection(params.get("direction") === "desc" ? "desc" : "asc");
      const requestedPage = Number(params.get("page"));
      setPage(Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1);
      setDetail(null); setUrlReady(true);
    }
    restore(); window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);


  const activeList = lists.find((list) => list.id === activeId);
  // A direct list URL must initialize its saved filters once the store responds.
  const [initializedList, setInitializedList] = useState("");
  useEffect(() => {
    if (activeId && activeList?.id === activeId && initializedList !== activeId) {
      if (!urlFilterPreview.current) setFilters(activeList.membershipMode === "dynamic" ? normalizedFilters(activeList.filters) : { ...EMPTY_FILTERS });
      setInitializedList(activeId);
    }
  }, [activeId, activeList, initializedList]);

  const currentList = view === "lists" ? activeList : undefined;
  const memberIds = useMemo(() => new Set(currentList ? listMemberIds(currentList) : []), [currentList]);
  const byId = useMemo(() => new Map(catalog.rows.map((row) => [row.id, row])), [catalog.rows]);
  const baseRows = useMemo(() => currentList?.membershipMode === "fixed" ? catalog.rows.filter((row) => memberIds.has(row.id)) : catalog.rows, [catalog.rows, currentList?.membershipMode, memberIds]);
  const rows = useMemo(() => {
    const filtered = filterCatalogRecords(baseRows, filters);
    return sort === "name" ? [...filtered].sort((a, b) => (direction === "desc" ? -1 : 1) * catalogRowName(a).localeCompare(catalogRowName(b), undefined, { numeric: true }) || a.id.localeCompare(b.id)) : sortCatalogRecords(filtered, sort, direction);
  }, [baseRows, filters, sort, direction]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const fixedLists = lists.filter((list) => list.membershipMode !== "dynamic");
  const activeFilterCount = Object.entries(filters).filter(([, value]) => value && value !== "all").length;
  const selectedInView = rows.filter((row) => selected.has(row.id)).length;
  const missingMembers = currentList?.membershipMode === "fixed" ? listMemberIds(currentList).filter((id) => !byId.has(id)).length : 0;
  const dynamicChanged = currentList?.membershipMode === "dynamic" && JSON.stringify(normalizedFilters(currentList.filters)) !== JSON.stringify(filters);
  const canReview = catalog.viewer?.canReview === true;
  const prospectsHref = admin ? "/admin/prospects" : "/dashboard/targets";
  const reviewTasks = new Set(rows.flatMap((row) => (row.reviewLanes || []).filter((lane) => !["approved", "merged", "rejected", "failed", "dismissed"].includes(lane.status)).map((lane) => `${lane.lane}:${lane.queueItemId}`))).size;
  const filteredLists = lists.filter((list) => `${list.name} ${list.notes || ""} ${list.workflow?.owner || ""}`.toLowerCase().includes(listQuery.toLowerCase())).filter((list) => {
    if (listView === "all") return true;
    if (listView === "unassigned") return !list.workflow?.owner;
    return !!list.workflow?.nextActionAt && Date.parse(list.workflow.nextActionAt) <= Date.now();
  });
  const marketRows = useMemo(() => filterCatalogRecords(catalog.rows, { market: filters.market }), [catalog.rows, filters.market]);
  const verticalRows = useMemo(() => filterCatalogRecords(marketRows, { vertical: filters.vertical }), [marketRows, filters.vertical]);
  const options = useMemo(() => ({
    market: [...new Set(catalog.rows.map((row) => row.market || "Unknown"))].sort(),
    vertical: [...new Set(marketRows.flatMap((row) => row.verticals?.length ? row.verticals : [row.vertical || "Unknown"]))].sort(),
    platform: [...new Set(verticalRows.flatMap((row) => { const labels = profilePlatformLabels(row.profile); return labels.length ? labels : ["Unknown"]; }))].sort(),
    city: [...new Set(catalog.rows.map((row) => row.city).filter(Boolean))].sort(),
    reviewStatus: [...new Set(catalog.rows.map((row) => row.reviewStatus).filter(Boolean))].sort(),
  }), [catalog.rows, marketRows, verticalRows]);

  useEffect(() => {
    if (!urlReady || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    for (const key of Object.keys(EMPTY_FILTERS) as Array<keyof CatalogFilters>) {
      const value = filters[key];
      if (value && value !== "all") url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
    url.searchParams.set("sort", sort); url.searchParams.set("direction", direction);
    if (page > 1) url.searchParams.set("page", String(page)); else url.searchParams.delete("page");
    if (currentList?.membershipMode === "dynamic" && dynamicChanged) url.searchParams.set("preview", "1"); else url.searchParams.delete("preview");
    window.history.replaceState(window.history.state, "", url);
  }, [filters, sort, direction, page, urlReady, currentList?.membershipMode, dynamicChanged]);

  function changeFilter<Key extends keyof CatalogFilters>(key: Key, value: CatalogFilters[Key]) {
    setFilters((previous) => ({ ...previous, [key]: value, ...(key === "market" ? { vertical: "", platform: "" } : key === "vertical" ? { platform: "" } : {}) })); setPage(1);
  }
  function openList(list: CatalogList) {
    const url = new URL(window.location.href); url.pathname = admin ? "/admin/lists" : "/dashboard/lists"; url.searchParams.set("listId", list.id); window.history.replaceState(window.history.state, "", url);
    setSaveMode(null); setView("lists"); setActiveId(list.id); setFilters(list.membershipMode === "dynamic" ? normalizedFilters(list.filters) : { ...EMPTY_FILTERS });
    setSelected(new Set()); setPage(1); setError(""); setNotice("");
  }

  function updateList(list: CatalogList) { setLists((previous) => [list, ...previous.filter((item) => item.id !== list.id)]); }
  function toggleSelected(id: string) { setSelected((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  async function saveList(mode: "fixed" | "dynamic") {
    if (mutationBusy.current) return;
    if (!newName.trim()) { setError("Give the list a name first."); return; }
    if (mode === "fixed" && !selected.size) return;
    mutationBusy.current = true;
    setPending(`create-${mode}`); setError(""); setNotice("");
    try {
      const result = await postList({ op: "create", name: newName.trim(), membershipMode: mode, ...(mode === "fixed" ? { catalogIds: [...selected] } : { filters: normalizeCatalogFilters(filters) }) });
      if (!result.list) throw new Error("The server did not return the saved list. Refresh to verify.");
      updateList(result.list); setNewName(""); openList(result.list);
      setNotice(`Saved “${result.list.name}” as a ${mode === "fixed" ? "fixed selection" : "live filter"} list.`);
    } catch (failure) { setError(message(failure)); }
    finally { mutationBusy.current = false; setPending(""); }
  }
  async function changeMembership(op: "addMany" | "removeMany", listId: string) {
    if (mutationBusy.current || !listId || !selected.size) return;
    mutationBusy.current = true;
    setPending(op); setError(""); setNotice("");
    try {
      const result = await postList({ op, id: listId, catalogIds: [...selected] });
      if (!result.list) throw new Error("The server did not return the saved list. Refresh to verify.");
      updateList(result.list); setSelected(new Set());
      setNotice(op === "addMany" ? `Selection saved to “${result.list.name}”.` : `Selection removed from “${result.list.name}”.`);
    } catch (failure) { setError(message(failure)); }
    finally { mutationBusy.current = false; setPending(""); }
  }
  async function saveDynamicFilters() {
    if (mutationBusy.current || !currentList) return;
    mutationBusy.current = true;
    setPending("filters"); setError(""); setNotice("");
    try {
      const result = await postList({ op: "setFilters", id: currentList.id, filters: normalizeCatalogFilters(filters) });
      if (!result.list) throw new Error("The server did not return the saved list. Refresh to verify.");
      updateList(result.list); setNotice("Live filters saved. Membership follows these filters as the catalog changes.");
    } catch (failure) { setError(message(failure)); }
    finally { mutationBusy.current = false; setPending(""); }
  }

  return <div className={styles.workspace}>
    <header className={styles.header}>
      <div><div className={styles.eyebrow}>Shared catalog</div><h1>{view === "lists" ? "My lists" : title}</h1></div>
      <div className={styles.headerActions}><button className={styles.button} disabled={loading || !!pending} onClick={() => void reload()}>{loading ? "Loading…" : "Refresh view"}</button></div>
    </header>
    <div className={styles.stats} aria-label="Counts in current view">
      <div><strong>{new Set(rows.filter((row) => row.entityType === "provider").map((row) => row.id)).size.toLocaleString()}</strong><span>Providers in view</span></div>
      <div><strong>{new Set(rows.filter((row) => row.entityType === "business").map((row) => row.id)).size.toLocaleString()}</strong><span>Businesses / locations</span></div>
      <div><strong>{reviewTasks.toLocaleString()}</strong><span>Open review tasks in view</span></div>
      <div><strong>{lists.length}</strong><span>Saved lists</span></div>
    </div>
    {catalog.coverage?.warnings?.length ? <details className={styles.warning}><summary>Catalog coverage · {catalog.coverage.warnings.length} notes</summary><ul>{catalog.coverage.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details> : null}
    {catalogError ? <div role="alert" className={styles.error}>Catalog could not be refreshed: {catalogError}{catalog.rows.length ? " Previously loaded records remain visible." : ""} <button className={styles.textButton} onClick={() => void reload()}>Retry</button></div> : null}
    {listError ? <div role="alert" className={styles.error}>Saved lists could not be refreshed: {listError} <button className={styles.textButton} onClick={() => void reload()}>Retry</button></div> : null}
    {error ? <div role="alert" className={styles.error}>{error}</div> : null}
    {notice ? <div role="status" className={styles.success}>{notice}</div> : null}
    {view === "catalog" ? <nav className={styles.tabs} aria-label="Prospect views"><button className={filters.needsReview !== "yes" ? styles.activeTab : styles.tab} onClick={() => changeFilter("needsReview", "all")}>All prospects</button><button className={filters.needsReview === "yes" ? styles.activeTab : styles.tab} onClick={() => changeFilter("needsReview", "yes")}>Needs review <span>{baseRows.filter(catalogNeedsReview).length}</span></button></nav> : <div className={styles.filterFooter}><Link href={prospectsHref} className={styles.textButton}>Find prospects</Link><Link href={admin ? "/admin/lists/work" : "/dashboard/ops"} className={styles.textButton}>Work / due items</Link></div>}
    <div className={view === "lists" ? styles.withSidebar : undefined}>
      {view === "lists" ? <aside className={styles.sidebar}>
        <label className={styles.field}><span>Find a list</span><input type="search" value={listQuery} onChange={(event) => setListQuery(event.target.value)} placeholder="Name, owner, or notes" /></label>
        <label className={styles.field}><span>List work</span><select value={listView} onChange={(event) => setListView(event.target.value as typeof listView)}><option value="all">All lists</option><option value="due">Due now</option><option value="unassigned">Unassigned</option></select></label>
        <div className={styles.listIndex}>{filteredLists.map((list) => <button key={list.id} className={currentList?.id === list.id ? styles.activeList : styles.listItem} onClick={() => openList(list)}><strong>{list.workflow?.pinned ? "★ " : ""}{list.name}</strong><span>{list.membershipMode === "dynamic" ? "Live filter" : "Fixed selection"} · {listMemberIds(list).length.toLocaleString()} records</span><small>{list.workflow?.owner || "Unassigned"} · {readable(list.workflow?.stage || "new")}</small>{list.workflow?.nextAction ? <small>{list.workflow.nextAction}</small> : null}{list.workflow?.nextActionAt ? <small>Due {dateLabel(list.workflow.nextActionAt)}</small> : null}</button>)}</div>
        {!lists.length && !loading && !listError ? <p className={styles.muted}>No saved lists yet. Browse the catalog to save a selection or a live filter.</p> : null}
        {lists.length && !filteredLists.length ? <p className={styles.muted}>No lists match that search.</p> : null}
        <Link className={styles.button} href={prospectsHref}>Find prospects</Link>
      </aside> : null}
      <main className={styles.main}>
        {view === "lists" && !currentList ? <section className={styles.empty}><h2>{initialListId && !loading ? "List unavailable" : "Choose a working list"}</h2><p>{initialListId && !loading ? "This list was not returned by the current store. It may have been removed or be unavailable to this account." : "Open a saved list, or browse the catalog to create one."}</p><Link className={styles.button} href={prospectsHref}>Find prospects</Link></section> : <>
          {currentList ? <section className={styles.panel}>
            <div className={styles.listHeading}><div><span className={styles.modeBadge}>{currentList.membershipMode === "dynamic" ? "Live filter list" : "Fixed selection list"}</span><h2>{currentList.name}</h2></div><a className={styles.button} href={`/api/targets/export?listId=${encodeURIComponent(currentList.id)}&format=csv`}>Export saved list CSV</a></div>
            <p className={styles.muted}>{currentList.membershipMode === "dynamic" ? "Membership is recomputed from the saved filters against the current catalog. New matches join automatically." : "Only explicitly selected records belong to this list. Changing filters or refreshing does not add records."}</p>
            <p className={styles.muted}>{listMemberIds(currentList).length.toLocaleString()} saved {currentList.membershipMode === "dynamic" ? "current matches" : "members"} · Owner: {currentList.workflow?.owner || "Unassigned"}{currentList.workflow?.nextAction ? ` · Next: ${currentList.workflow.nextAction}` : ""}</p>
            {currentList.unresolvedLegacyItems?.length ? <p className={styles.warning}>{currentList.unresolvedLegacyItems.length} legacy reference(s) are preserved but have not been linked to an exact catalog record. Export includes these unresolved references.</p> : null}
            {missingMembers ? <p className={styles.warning}>{missingMembers} saved member{missingMembers === 1 ? " is" : "s are"} not present in this catalog snapshot. Membership is preserved.</p> : null}
            <ListEditor key={currentList.id} list={currentList} onUpdated={updateList} />
          </section> : null}
          <section className={styles.filters} aria-label="Catalog filters">
            <div className={styles.contextFilters}>
              <label className={styles.field}><span>Market</span><select value={filters.market} onChange={(event) => changeFilter("market", event.target.value)}><option value="">All markets</option>{options.market.map((value) => <option key={value} value={value}>{value === "Unknown" ? "Unkwn" : value}</option>)}</select></label>
              <label className={styles.field}><span>Vertical</span><select value={filters.vertical} onChange={(event) => changeFilter("vertical", event.target.value)}><option value="">All verticals</option>{options.vertical.map((value) => <option key={value} value={value}>{value === "Unknown" ? "Unkwn" : value}</option>)}</select></label>
              <label className={styles.field}><span>Platform</span><select value={filters.platform} onChange={(event) => changeFilter("platform", event.target.value)}><option value="">All platforms</option>{options.platform.map((value) => <option key={value} value={value}>{value === "Unknown" ? "Unkwn" : value}</option>)}</select></label>
            </div>
            <label className={`${styles.field} ${styles.search}`}><span>Search prospects</span><input type="search" value={filters.q} onChange={(event) => changeFilter("q", event.target.value)} placeholder="Name, business, service or exact link…" /></label>
            <details className={styles.secondaryFilters}><summary>More filters</summary><div className={styles.filterGrid}>
              <label className={styles.field}><span>Record type</span><select value={filters.entityType} onChange={(event) => changeFilter("entityType", event.target.value)}><option value="">Providers & businesses</option><option value="provider">Providers</option><option value="business">Businesses / locations</option></select></label>
              <label className={styles.field}><span>Service</span><input value={filters.service} onChange={(event) => changeFilter("service", event.target.value)} placeholder="Any service" /></label>
              <label className={styles.field}><span>Area</span><input value={filters.area} onChange={(event) => changeFilter("area", event.target.value)} placeholder="Any area" /></label>
              <label className={styles.field}><span>City</span><select value={filters.city} onChange={(event) => changeFilter("city", event.target.value)}><option value="">All cities</option>{options.city.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label className={styles.field}><span>ZIP</span><input value={filters.postalCode} onChange={(event) => changeFilter("postalCode", event.target.value)} placeholder="Any ZIP" inputMode="numeric" /></label>
              <label className={styles.field}><span>Review status</span><select value={filters.reviewStatus} onChange={(event) => changeFilter("reviewStatus", event.target.value)}><option value="">All statuses</option>{options.reviewStatus.map((value) => <option key={value} value={value}>{readable(value)}</option>)}</select></label>
              <label className={styles.field}><span>Exact booking link</span><select value={filters.hasBooking} onChange={(event) => changeFilter("hasBooking", event.target.value as CatalogFilters["hasBooking"])}><option value="all">Any</option><option value="yes">Available</option><option value="no">Not found</option></select></label>
              <label className={styles.field}><span>Social link</span><select value={filters.hasSocial} onChange={(event) => changeFilter("hasSocial", event.target.value as CatalogFilters["hasSocial"])}><option value="all">Any</option><option value="yes">Available</option><option value="no">Not found</option></select></label>
            </div></details>
            <div className={styles.filterFooter}><span>{activeFilterCount ? `${activeFilterCount} active filters` : "All records in view"}</span><button className={styles.button} disabled={!!pending || !!listError || !!catalogError || loading} onClick={() => { setSaveMode(saveMode === "dynamic" ? null : "dynamic"); setNewName(""); }}>Save this search</button><button className={styles.textButton} onClick={() => { setFilters({ ...EMPTY_FILTERS }); setPage(1); }}>Clear filters</button>{currentList?.membershipMode === "dynamic" ? <><button className={styles.button} disabled={!!pending || !dynamicChanged || !!catalogError} onClick={() => void saveDynamicFilters()}>{pending === "filters" ? "Saving…" : "Save live filter changes"}</button>{dynamicChanged ? <span className={styles.draftLabel}>Unsaved filter preview · Export uses saved filters</span> : null}</> : null}</div>
            {saveMode === "dynamic" ? <form className={styles.inlineForm} onSubmit={(event) => { event.preventDefault(); void saveList("dynamic"); }}><label className={styles.field}><span>Live-filter list name</span><input required value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Name this search" /></label><button className={styles.primaryButton} disabled={!!pending || !newName.trim()}>{pending === "create-dynamic" ? "Saving…" : "Save live-filter list"}</button><button type="button" className={styles.textButton} disabled={!!pending} onClick={() => setSaveMode(null)}>Cancel</button><p className={styles.muted}>Matches update with the catalog. This does not send messages.</p></form> : null}
          </section>
          {selected.size ? <section id="catalog-selection-actions" tabIndex={-1} className={styles.saveBar} aria-label="Save catalog records">
            <div><strong>{selected.size.toLocaleString()} selected</strong><p>{selected.size > selectedInView ? `${selected.size - selectedInView} selected outside this filtered view. ` : ""}Selections stay fixed until you change them.</p></div>
            <div className={styles.selectionActions}><label className={styles.field}><span>Fixed list</span><select value={destinationId} onChange={(event) => setDestinationId(event.target.value)}><option value="">Choose a list…</option>{fixedLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></label><button className={styles.primaryButton} disabled={!destinationId || !!pending || !!listError || !!catalogError} onClick={() => void changeMembership("addMany", destinationId)}>Add to list</button><button className={styles.button} disabled={!!pending || !!listError || !!catalogError} onClick={() => { setSaveMode(saveMode === "fixed" ? null : "fixed"); setNewName(""); }}>Create fixed list</button>{currentList?.membershipMode === "fixed" ? <button className={styles.button} disabled={!!pending || !!listError} onClick={() => void changeMembership("removeMany", currentList.id)}>Remove selected from this list</button> : null}<button className={styles.textButton} onClick={() => { setSelected(new Set()); setSaveMode(null); }}>Clear selection</button></div>
            {saveMode === "fixed" ? <form className={styles.inlineForm} onSubmit={(event) => { event.preventDefault(); void saveList("fixed"); }}><label className={styles.field}><span>Fixed list name</span><input required value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Name this selection" /></label><button className={styles.primaryButton} disabled={!!pending || !newName.trim()}>{pending === "create-fixed" ? "Saving…" : "Save fixed list"}</button><button type="button" className={styles.textButton} disabled={!!pending} onClick={() => setSaveMode(null)}>Cancel</button></form> : null}
          </section> : null}
          <div className={styles.tableToolbar}><div><strong>{rows.length.toLocaleString()}</strong> matching records{currentList?.membershipMode === "dynamic" && dynamicChanged ? " in preview" : ""}<span className={styles.muted}> · Click an arrow to sort</span></div><button className={styles.textButton} disabled={!rows.length || loading} onClick={() => setSelected((previous) => new Set([...previous, ...rows.map((row) => row.id)]))}>Select all {rows.length.toLocaleString()} matching</button></div>
          <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Scrollable catalog results">
            <table className={styles.table}><caption className={styles.srOnly}>Shared catalog. Business and location records are not individual people. Exact links are source-attributed.</caption><colgroup><col className={styles.selectionColumn} /><col className={styles.nameColumn} /><col className={styles.platformColumn} /><col className={styles.contactColumn} /><col className={styles.locationColumn} /><col className={styles.licenseColumn} /></colgroup><thead><tr><th className={styles.checkboxCell}><input type="checkbox" aria-label="Select this page" checked={!!visibleRows.length && visibleRows.every((row) => selected.has(row.id))} disabled={!visibleRows.length} onChange={(event) => { const checked = event.target.checked; setSelected((previous) => { const next = new Set(previous); visibleRows.forEach((row) => { if (checked) next.add(row.id); else next.delete(row.id); }); return next; }); }} /></th>{COLUMNS.map((column) => <th key={column.key} scope="col" className={column.centered ? styles.centerCell : undefined} aria-sort={sort === column.key ? direction === "asc" ? "ascending" : "descending" : "none"}><button onClick={() => { if (sort === column.key) setDirection(direction === "asc" ? "desc" : "asc"); else { setSort(column.key); setDirection("asc"); } setPage(1); }}>{column.label}{sort === column.key ? direction === "asc" ? " ↑" : " ↓" : " ↕"}</button></th>)}<th scope="col" className={styles.centerCell} title="Person license for providers; shop registration for businesses and locations">License</th></tr></thead>
              <tbody>{visibleRows.map((row) => <CatalogResultRow key={row.id} row={row} selected={selected.has(row.id)} onToggle={() => toggleSelected(row.id)} onOpen={() => setDetail(row)} />)}</tbody>
            </table>
            {!visibleRows.length ? <div className={styles.empty} role="status"><h3>{loading ? "Loading catalog…" : catalogError ? "Catalog unavailable" : currentList?.membershipMode === "fixed" && !listMemberIds(currentList).length ? "This fixed list is empty" : "No matching records"}</h3><p>{loading ? "Fetching the current source-linked catalog and saved lists." : catalogError ? "Retry the catalog request above." : "Try changing your filters or browse the full catalog."}</p></div> : null}
          </div>
          <footer className={styles.pagination}><span>Page {currentPage} of {pageCount} · {PAGE_SIZE} per page</span><div><button className={styles.button} disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button><button className={styles.button} disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></div></footer>
        </>}
      </main>
    </div>
    <p className={styles.footnote}>Source-reported claims remain distinct from review decisions. Catalog inclusion is not approval. Last refreshed: {dateLabel(catalog.generatedAt)}.</p>
    {detail ? <CatalogDetail key={detail.id} admin={canReview} record={detail} onClose={() => setDetail(null)} onRefreshed={reload} onSelectForList={() => {
      setSelected((previous) => new Set([...previous, detail.id]));
      setDetail(null);
      requestAnimationFrame(() => {
        const selection = document.getElementById("catalog-selection-actions");
        selection?.focus({ preventScroll: true });
        selection?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }} /> : null}
  </div>;
}
