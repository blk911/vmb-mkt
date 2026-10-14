"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProfileLinks } from "@/components/admin/pipeline/ProfileEvidence";
import { readJson, readable, listMemberIds, type CatalogList, type CatalogRecord } from "./catalog-ui-types";

export default function CatalogPrint({ listId }: { listId: string }) {
  const [result, setResult] = useState<{ list: CatalogList; rows: CatalogRecord[]; missing: number } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([readJson<{ lists: CatalogList[] }>("/api/targets/lists", { signal: controller.signal }), readJson<{ rows: CatalogRecord[] }>("/api/catalog", { signal: controller.signal })])
      .then(([listResult, catalog]) => {
        const list = listResult.lists.find((item) => item.id === listId);
        if (!list) throw new Error("This list could not be found in the current store.");
        const ids = new Set(listMemberIds(list));
        const rows = catalog.rows.filter((row) => ids.has(row.id));
        if (!controller.signal.aborted) { setResult({ list, rows, missing: ids.size - rows.length }); setError(""); }
      }).catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [listId, attempt]);
  return <div className="bg-white p-6 text-slate-900">
    <div className="mb-6 flex gap-4 print:hidden"><Link href={`/dashboard/lists?listId=${encodeURIComponent(listId)}`} className="text-blue-700 underline">Back to list</Link><button className="rounded border px-3 py-1" disabled={!result || !!error} onClick={() => window.print()}>Print</button></div>
    {error ? <div role="alert">{error} <button className="text-blue-700 underline" onClick={() => setAttempt((value) => value + 1)}>Retry</button></div> : !result ? <p role="status">Loading the current list and source-linked catalog…</p> : <>
      <h1 className="text-2xl font-bold">{result.list.name}</h1><p className="mt-1 text-sm text-slate-600">{result.list.membershipMode === "dynamic" ? "Live filter list" : "Fixed selection list"} · {result.rows.length} current records · Owner: {result.list.workflow?.owner || "Unassigned"}</p>
      {result.list.unresolvedLegacyItems?.length ? <p className="mt-3 text-sm text-amber-800">{result.list.unresolvedLegacyItems.length} unresolved legacy references are preserved. Use CSV export to inspect those references.</p> : null}
      {result.missing ? <p className="mt-3 text-sm text-amber-800">{result.missing} saved members are unavailable in the current catalog snapshot. Their membership is preserved.</p> : null}
      {result.list.notes ? <p className="my-4 whitespace-pre-wrap text-sm">{result.list.notes}</p> : null}
      {result.rows.map((row) => <section key={row.id} className="break-inside-avoid border-b border-slate-200 py-5"><h2 className="font-semibold">{row.platformLabel} · {row.displayName}</h2><p className="text-xs text-slate-600">{row.entityType === "business" ? "Business / location · Not a person" : "Provider record"} · {readable(row.reviewStatus)}</p><p className="mt-2 text-sm">{[row.businessName, row.city, row.state, row.postalCode, row.area].filter(Boolean).join(" · ")}</p><p className="text-sm">Services: {row.services.join(", ") || "Unknown"}</p><div className="mt-2 text-sm"><ProfileLinks links={row.profile?.bookingLinks || []} empty="No exact profile link found" /></div><div className="mt-2 text-sm"><ProfileLinks links={row.profile?.socialLinks || []} empty="No social link found" /></div></section>)}
      {!result.rows.length ? <p className="py-8 text-slate-600">This list has no current catalog records.</p> : null}
    </>}
  </div>;
}
