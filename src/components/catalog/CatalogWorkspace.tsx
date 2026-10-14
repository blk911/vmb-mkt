"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CatalogCoverage } from "@/lib/catalog/types";
import { filterCatalogRecords, normalizeCatalogFilters, sortCatalogRecords } from "@/lib/catalog/query";
import { ProfileLinks } from "@/components/admin/pipeline/ProfileEvidence";
import { safeProfileHref, profilePlatformLabels, profilePlatformLabel, profilePlatformExplanation, profileMissingLinkLabel } from "@/lib/admin/pipeline/profile-presentation";
import CatalogDetail from "./CatalogDetail";
import ListEditor from "./ListEditor";
import { EMPTY_FILTERS, dateLabel, listMemberIds, postList, readable, readJson, type CatalogFilters, type CatalogList, type CatalogRecord } from "./catalog-ui-types";
import styles from "./CatalogWorkspace.module.css";

type CatalogResponse = { rows: CatalogRecord[]; coverage?: CatalogCoverage; generatedAt?: string };
type SortColumn = "platform" | "booking" | "social" | "provider" | "salon" | "service" | "area" | "city" | "postalCode" | "status";
const PAGE_SIZE = 30;
const COLUMNS: Array<{ key: SortColumn; label: string }> = [
  { key: "platform", label: "Platform / record" }, { key: "booking", label: "Profile / booking" }, { key: "social", label: "Social" },
  { key: "provider", label: "Provider" }, { key: "salon", label: "Salon / business" }, { key: "service", label: "Services" },
  { key: "area", label: "Area" }, { key: "city", label: "City" }, { key: "postalCode", label: "ZIP" }, { key: "status", label: "Review status" },
];

function normalizedFilters(value?: Partial<CatalogFilters>): CatalogFilters {
  return { ...EMPTY_FILTERS, ...normalizeCatalogFilters(value) };
}

function message(failure: unknown) { return failure instanceof Error ? failure.message : "Something went wrong. Please retry."; }

export default function CatalogWorkspace({ initialView = "catalog", initialListId = "", title = "Shared catalog", admin = false }: { initialView?: "catalog" | "lists"; initialListId?: string; title?: string; admin?: boolean }) {
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
  const [destinationId, setDestinationId] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reload = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    const [catalogResult, listResult] = await Promise.allSettled([
      readJson<CatalogResponse>("/api/catalog", { signal }), readJson<{ lists: CatalogList[] }>("/api/targets/lists", { signal }),
    ]);
    if (signal?.aborted) return;
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
    return () => controller.abort();
  }, [reload]);

  const activeList = lists.find((list) => list.id === activeId);
  // A direct list URL must initialize its saved filters once the store responds.
  const [initializedList, setInitializedList] = useState("");
  useEffect(() => {
    if (initialListId && activeList?.id === initialListId && initializedList !== initialListId) {
      setFilters(activeList.membershipMode === "dynamic" ? normalizedFilters(activeList.filters) : { ...EMPTY_FILTERS });
      setInitializedList(initialListId);
    }
  }, [initialListId, activeList, initializedList]);

  const currentList = view === "lists" ? activeList : undefined;
  const memberIds = useMemo(() => new Set(currentList ? listMemberIds(currentList) : []), [currentList]);
  const byId = useMemo(() => new Map(catalog.rows.map((row) => [row.id, row])), [catalog.rows]);
  const baseRows = useMemo(() => currentList?.membershipMode === "fixed" ? catalog.rows.filter((row) => memberIds.has(row.id)) : catalog.rows, [catalog.rows, currentList?.membershipMode, memberIds]);
  const rows = useMemo(() => sortCatalogRecords(filterCatalogRecords(baseRows, filters), sort, direction), [baseRows, filters, sort, direction]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const fixedLists = lists.filter((list) => list.membershipMode !== "dynamic");
  const activeFilterCount = Object.entries(filters).filter(([, value]) => value && value !== "all").length;
  const selectedInView = rows.filter((row) => selected.has(row.id)).length;
  const missingMembers = currentList?.membershipMode === "fixed" ? listMemberIds(currentList).filter((id) => !byId.has(id)).length : 0;
  const dynamicChanged = currentList?.membershipMode === "dynamic" && JSON.stringify(normalizedFilters(currentList.filters)) !== JSON.stringify(filters);
  const options = useMemo(() => ({
    platform: [...new Set(catalog.rows.flatMap((row) => profilePlatformLabels(row.profile)).filter(Boolean))].sort(),
    city: [...new Set(catalog.rows.map((row) => row.city).filter(Boolean))].sort(),
    reviewStatus: [...new Set(catalog.rows.map((row) => row.reviewStatus).filter(Boolean))].sort(),
  }), [catalog.rows]);

  function changeFilter<Key extends keyof CatalogFilters>(key: Key, value: CatalogFilters[Key]) {
    setFilters((previous) => ({ ...previous, [key]: value })); setPage(1);
  }
  function openList(list: CatalogList) {
    const url = new URL(window.location.href); url.searchParams.set("listId", list.id); window.history.replaceState(null, "", url);
    setView("lists"); setActiveId(list.id); setFilters(list.membershipMode === "dynamic" ? normalizedFilters(list.filters) : { ...EMPTY_FILTERS });
    setSelected(new Set()); setPage(1); setError(""); setNotice("");
  }
  function browse() { const url = new URL(window.location.href); url.searchParams.delete("listId"); window.history.replaceState(null, "", url); setView("catalog"); setActiveId(""); setFilters({ ...EMPTY_FILTERS }); setSelected(new Set()); setPage(1); }
  function updateList(list: CatalogList) { setLists((previous) => [list, ...previous.filter((item) => item.id !== list.id)]); }
  function toggleSelected(id: string) { setSelected((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  async function saveList(mode: "fixed" | "dynamic") {
    if (!newName.trim()) { setError("Give the list a name first."); return; }
    if (mode === "fixed" && !selected.size) return;
    setPending(`create-${mode}`); setError(""); setNotice("");
    try {
      const result = await postList({ op: "create", name: newName.trim(), membershipMode: mode, ...(mode === "fixed" ? { catalogIds: [...selected] } : { filters: normalizeCatalogFilters(filters) }) });
      if (!result.list) throw new Error("The server did not return the saved list. Refresh to verify.");
      updateList(result.list); setNewName(""); openList(result.list);
      setNotice(`Saved “${result.list.name}” as a ${mode === "fixed" ? "fixed selection" : "live filter"} list.`);
    } catch (failure) { setError(message(failure)); }
    finally { setPending(""); }
  }
  async function changeMembership(op: "addMany" | "removeMany", listId: string) {
    if (!listId || !selected.size) return;
    setPending(op); setError(""); setNotice("");
    try {
      const result = await postList({ op, id: listId, catalogIds: [...selected] });
      if (!result.list) throw new Error("The server did not return the saved list. Refresh to verify.");
      updateList(result.list); setSelected(new Set());
      setNotice(op === "addMany" ? `Selection saved to “${result.list.name}”.` : `Selection removed from “${result.list.name}”.`);
    } catch (failure) { setError(message(failure)); }
    finally { setPending(""); }
  }
  async function saveDynamicFilters() {
    if (!currentList) return;
    setPending("filters"); setError(""); setNotice("");
    try {
      const result = await postList({ op: "setFilters", id: currentList.id, filters: normalizeCatalogFilters(filters) });
      if (!result.list) throw new Error("The server did not return the saved list. Refresh to verify.");
      updateList(result.list); setNotice("Live filters saved. Membership follows these filters as the catalog changes.");
    } catch (failure) { setError(message(failure)); }
    finally { setPending(""); }
  }

  return <div className={styles.workspace}>
    <header className={styles.header}>
      <div><div className={styles.eyebrow}>One catalog · Source-linked records</div><h1>{title}</h1><p>Find profiles, check the evidence, and organize durable working lists.</p></div>
      <div className={styles.headerActions}>{admin ? <><Link className={styles.button} href="/admin/build">Build</Link><Link className={styles.button} href="/admin/validate">Review</Link></> : null}<button className={styles.button} disabled={loading || !!pending} onClick={() => void reload()}>{loading ? "Loading…" : "Refresh catalog & lists"}</button></div>
    </header>
    <div className={styles.stats}>
      <div><strong>{loading && !catalog.rows.length ? "…" : catalog.rows.length.toLocaleString()}</strong><span>Catalog records</span></div>
      <div><strong>{catalog.rows.filter((row) => row.entityType === "provider").length.toLocaleString()}</strong><span>Provider records</span></div>
      <div><strong>{catalog.rows.filter((row) => row.entityType === "business").length.toLocaleString()}</strong><span>Businesses / locations</span></div>
      <div><strong>{lists.length}</strong><span>Saved lists</span></div>
    </div>
    {catalog.coverage?.warnings?.length ? <div className={styles.warning}><strong>Catalog coverage</strong><ul>{catalog.coverage.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div> : null}
    {catalogError ? <div role="alert" className={styles.error}>Catalog could not be refreshed: {catalogError}{catalog.rows.length ? " Previously loaded records remain visible." : ""} <button className={styles.textButton} onClick={() => void reload()}>Retry</button></div> : null}
    {listError ? <div role="alert" className={styles.error}>Saved lists could not be refreshed: {listError} <button className={styles.textButton} onClick={() => void reload()}>Retry</button></div> : null}
    {error ? <div role="alert" className={styles.error}>{error}</div> : null}
    {notice ? <div role="status" className={styles.success}>{notice}</div> : null}
    <nav className={styles.tabs} aria-label="Catalog workspace"><button className={view === "catalog" ? styles.activeTab : styles.tab} onClick={browse}>Browse catalog</button><button className={view === "lists" ? styles.activeTab : styles.tab} onClick={() => { setView("lists"); setSelected(new Set()); }}>Saved lists <span>{lists.length}</span></button></nav>
    <div className={view === "lists" ? styles.withSidebar : undefined}>
      {view === "lists" ? <aside className={styles.sidebar}>
        <label className={styles.field}><span>Find a list</span><input type="search" value={listQuery} onChange={(event) => setListQuery(event.target.value)} placeholder="Name, owner, or notes" /></label>
        <div className={styles.listIndex}>{lists.filter((list) => `${list.name} ${list.notes || ""} ${list.workflow?.owner || ""}`.toLowerCase().includes(listQuery.toLowerCase())).map((list) => <button key={list.id} className={currentList?.id === list.id ? styles.activeList : styles.listItem} onClick={() => openList(list)}><strong>{list.workflow?.pinned ? "★ " : ""}{list.name}</strong><span>{list.membershipMode === "dynamic" ? "Live filter" : "Fixed selection"} · {listMemberIds(list).length.toLocaleString()} records</span><small>{list.workflow?.owner || "Unassigned"} · {readable(list.workflow?.stage || "new")}</small></button>)}</div>
        {!lists.length && !loading && !listError ? <p className={styles.muted}>No saved lists yet. Browse the catalog to save a selection or a live filter.</p> : null}
        {lists.length && !lists.some((list) => `${list.name} ${list.notes || ""} ${list.workflow?.owner || ""}`.toLowerCase().includes(listQuery.toLowerCase())) ? <p className={styles.muted}>No lists match that search.</p> : null}
        <button className={styles.button} onClick={browse}>Create from catalog</button>
      </aside> : null}
      <main className={styles.main}>
        {view === "lists" && !currentList ? <section className={styles.empty}><h2>{initialListId && !loading ? "List unavailable" : "Choose a working list"}</h2><p>{initialListId && !loading ? "This list was not returned by the current store. It may have been removed or be unavailable to this account." : "Open a saved list, or browse the catalog to create one."}</p><button className={styles.button} onClick={browse}>Browse catalog</button></section> : <>
          {currentList ? <section className={styles.panel}>
            <div className={styles.listHeading}><div><span className={styles.modeBadge}>{currentList.membershipMode === "dynamic" ? "Live filter list" : "Fixed selection list"}</span><h2>{currentList.name}</h2></div><a className={styles.button} href={`/api/targets/export?listId=${encodeURIComponent(currentList.id)}&format=csv`}>Export saved list CSV</a></div>
            <p className={styles.muted}>{currentList.membershipMode === "dynamic" ? "Membership is recomputed from the saved filters against the current catalog. New matches join automatically." : "Only explicitly selected records belong to this list. Changing filters or refreshing does not add records."}</p>
            <p className={styles.muted}>{listMemberIds(currentList).length.toLocaleString()} saved {currentList.membershipMode === "dynamic" ? "current matches" : "members"} · Owner: {currentList.workflow?.owner || "Unassigned"}{currentList.workflow?.nextAction ? ` · Next: ${currentList.workflow.nextAction}` : ""}</p>
            {currentList.unresolvedLegacyItems?.length ? <p className={styles.warning}>{currentList.unresolvedLegacyItems.length} legacy reference(s) are preserved but have not been linked to an exact catalog record. Export includes these unresolved references.</p> : null}
            {missingMembers ? <p className={styles.warning}>{missingMembers} saved member{missingMembers === 1 ? " is" : "s are"} not present in this catalog snapshot. Membership is preserved.</p> : null}
            <ListEditor key={currentList.id} list={currentList} onUpdated={updateList} />
          </section> : null}
          <section className={styles.filters} aria-label="Catalog filters">
            <label className={`${styles.field} ${styles.search}`}><span>Search profiles, businesses, services & exact links</span><input type="search" value={filters.q} onChange={(event) => changeFilter("q", event.target.value)} placeholder="Search the shared catalog…" /></label>
            <div className={styles.filterGrid}>
              <label className={styles.field}><span>Platform</span><select value={filters.platform} onChange={(event) => changeFilter("platform", event.target.value)}><option value="">All platforms</option>{options.platform.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label className={styles.field}><span>Record type</span><select value={filters.entityType} onChange={(event) => changeFilter("entityType", event.target.value)}><option value="">Providers & businesses</option><option value="provider">Providers</option><option value="business">Businesses / locations</option></select></label>
              <label className={styles.field}><span>Service</span><input value={filters.service} onChange={(event) => changeFilter("service", event.target.value)} placeholder="Any service" /></label>
              <label className={styles.field}><span>Area</span><input value={filters.area} onChange={(event) => changeFilter("area", event.target.value)} placeholder="Any area" /></label>
              <label className={styles.field}><span>City</span><select value={filters.city} onChange={(event) => changeFilter("city", event.target.value)}><option value="">All cities</option>{options.city.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label className={styles.field}><span>ZIP</span><input value={filters.postalCode} onChange={(event) => changeFilter("postalCode", event.target.value)} placeholder="Any ZIP" inputMode="numeric" /></label>
              <label className={styles.field}><span>Review status</span><select value={filters.reviewStatus} onChange={(event) => changeFilter("reviewStatus", event.target.value)}><option value="">All statuses</option>{options.reviewStatus.map((value) => <option key={value} value={value}>{readable(value)}</option>)}</select></label>
              <label className={styles.field}><span>Exact booking link</span><select value={filters.hasBooking} onChange={(event) => changeFilter("hasBooking", event.target.value as CatalogFilters["hasBooking"])}><option value="all">Any</option><option value="yes">Available</option><option value="no">Not found</option></select></label>
              <label className={styles.field}><span>Social link</span><select value={filters.hasSocial} onChange={(event) => changeFilter("hasSocial", event.target.value as CatalogFilters["hasSocial"])}><option value="all">Any</option><option value="yes">Available</option><option value="no">Not found</option></select></label>
            </div>
            <div className={styles.filterFooter}><span>{activeFilterCount ? `${activeFilterCount} active filters` : "All records in view"}</span><button className={styles.textButton} onClick={() => { setFilters({ ...EMPTY_FILTERS }); setPage(1); }}>Clear filters</button>{currentList?.membershipMode === "dynamic" ? <><button className={styles.button} disabled={!!pending || !dynamicChanged || !!catalogError} onClick={() => void saveDynamicFilters()}>{pending === "filters" ? "Saving…" : "Save live filter changes"}</button>{dynamicChanged ? <span className={styles.draftLabel}>Unsaved filter preview · Export uses saved filters</span> : null}</> : null}</div>
          </section>
          <section className={styles.saveBar} aria-label="Save catalog records">
            <div><strong>{selected.size.toLocaleString()} selected</strong><p>{selected.size > selectedInView ? `${selected.size - selectedInView} selected outside this filtered view. ` : ""}Selections stay fixed until you change them.</p></div>
            <div className={styles.saveControls}><label className={styles.field}><span>New list name</span><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Name your working list" /></label><button className={styles.primaryButton} disabled={!!pending || !selected.size || !!listError || !!catalogError} onClick={() => void saveList("fixed")}>{pending === "create-fixed" ? "Saving…" : "Save selected as fixed list"}</button>{!currentList || currentList.membershipMode === "dynamic" ? <button className={styles.button} disabled={!!pending || !!listError || !!catalogError || loading} onClick={() => void saveList("dynamic")}>{pending === "create-dynamic" ? "Saving…" : "Save filters as live list"}</button> : null}</div>
            {selected.size ? <div className={styles.selectionActions}><label className={styles.field}><span>Add selection to fixed list</span><select value={destinationId} onChange={(event) => setDestinationId(event.target.value)}><option value="">Choose a fixed list…</option>{fixedLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></label><button className={styles.button} disabled={!destinationId || !!pending || !!listError} onClick={() => void changeMembership("addMany", destinationId)}>Add selected</button>{currentList?.membershipMode === "fixed" ? <button className={styles.button} disabled={!!pending || !!listError} onClick={() => void changeMembership("removeMany", currentList.id)}>Remove selected from this list</button> : null}<button className={styles.textButton} onClick={() => setSelected(new Set())}>Clear selection</button></div> : null}
          </section>
          <div className={styles.tableToolbar}><div><strong>{rows.length.toLocaleString()}</strong> matching records{currentList?.membershipMode === "dynamic" && dynamicChanged ? " in preview" : ""}<span className={styles.muted}> · Click a column to sort</span></div><button className={styles.textButton} disabled={!rows.length || loading} onClick={() => setSelected((previous) => new Set([...previous, ...rows.map((row) => row.id)]))}>Select all {rows.length.toLocaleString()} matching</button></div>
          <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Scrollable catalog results">
            <table className={styles.table}><caption className={styles.srOnly}>Shared catalog. Business and location records are not individual people. Exact links are source-attributed.</caption><thead><tr><th className={styles.checkboxCell}><input type="checkbox" aria-label="Select this page" checked={!!visibleRows.length && visibleRows.every((row) => selected.has(row.id))} disabled={!visibleRows.length} onChange={(event) => { const checked = event.target.checked; setSelected((previous) => { const next = new Set(previous); visibleRows.forEach((row) => { if (checked) next.add(row.id); else next.delete(row.id); }); return next; }); }} /></th>{COLUMNS.map((column) => <th key={column.key} aria-sort={sort === column.key ? direction === "asc" ? "ascending" : "descending" : "none"}><button onClick={() => { if (sort === column.key) setDirection(direction === "asc" ? "desc" : "asc"); else { setSort(column.key); setDirection("asc"); } setPage(1); }}>{column.label}{sort === column.key ? direction === "asc" ? " ↑" : " ↓" : " ↕"}</button></th>)}</tr></thead>
              <tbody>{visibleRows.map((row) => <tr key={row.id} data-selected={selected.has(row.id)}><td className={styles.checkboxCell}><input type="checkbox" aria-label={`Select ${row.displayName}`} checked={selected.has(row.id)} onChange={() => toggleSelected(row.id)} /></td><td><strong className={styles.platform}>{profilePlatformLabel(row.profile)}</strong><span className={row.entityType === "business" ? styles.businessBadge : styles.providerBadge}>{row.entityType === "business" ? "Business / location · not a person" : "Provider record"}</span><button className={styles.recordLink} onClick={() => setDetail(row)}>{row.displayName || "Open record"}</button><small className={styles.muted}>{profilePlatformExplanation(row.profile)}</small></td><td><ProfileLinks links={(row.profile?.bookingLinks || []).filter((link) => link.kind !== "directory" && safeProfileHref(link.url))} empty={profileMissingLinkLabel(row.profile)} compact /></td><td><ProfileLinks links={(row.profile?.socialLinks || []).filter((link) => safeProfileHref(link.url))} empty={profileMissingLinkLabel(row.profile, "social")} compact /></td><td>{row.entityType === "business" ? <span className={styles.muted}>Not a person</span> : row.providerName || "Unknown"}</td><td>{row.businessName || "Unknown"}</td><td>{row.services.join(", ") || <span className={styles.muted}>Unknown</span>}</td><td>{row.area || <span className={styles.muted}>Unknown</span>}</td><td>{[row.city, row.state].filter(Boolean).join(", ") || "Unknown"}</td><td>{row.postalCode || "Unknown"}</td><td><span className={styles.statusBadge}>{readable(row.reviewStatus)}</span>{row.conflicts.length ? <small className={styles.conflictLabel}>{row.conflicts.length} unresolved difference{row.conflicts.length === 1 ? "" : "s"}</small> : null}</td></tr>)}</tbody>
            </table>
            {!visibleRows.length ? <div className={styles.empty} role="status"><h3>{loading ? "Loading catalog…" : catalogError ? "Catalog unavailable" : currentList?.membershipMode === "fixed" && !listMemberIds(currentList).length ? "This fixed list is empty" : "No matching records"}</h3><p>{loading ? "Fetching the current source-linked catalog and saved lists." : catalogError ? "Retry the catalog request above." : "Try changing your filters or browse the full catalog."}</p></div> : null}
          </div>
          <footer className={styles.pagination}><span>Page {currentPage} of {pageCount} · {PAGE_SIZE} per page</span><div><button className={styles.button} disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button><button className={styles.button} disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></div></footer>
        </>}
      </main>
    </div>
    <p className={styles.footnote}>Source-reported claims remain distinct from review decisions. Catalog inclusion is not approval. Last refreshed: {dateLabel(catalog.generatedAt)}.</p>
    {detail ? <CatalogDetail key={detail.id} admin={admin} record={detail} onClose={() => setDetail(null)} onRefreshed={reload} /> : null}
  </div>;
}
