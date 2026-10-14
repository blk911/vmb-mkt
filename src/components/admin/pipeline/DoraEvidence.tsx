"use client";

import { useEffect, useRef, useState } from "react";
import type { DoraCheck, DoraCrossReference } from "@/lib/dora/types";
import { SourceLink } from "./ProfileEvidence";

function licenseSummary(check?: DoraCheck) {
  const match = check?.matches?.[0];
  const checkedAt = Date.parse(check?.checkedAt || "");
  const now = Date.now();
  // Status text on a candidate is not identity proof. Mirror the projected
  // check's confirmation safeguards before showing an affirmative symbol.
  const confirmed = check?.outcome === "matched"
    && check.matches?.length === 1 && !check.truncated
    && Array.isArray(check.conflicts) && check.conflicts.length === 0
    && match?.identity === "corroborated"
    && Array.isArray(match.conflicts) && match.conflicts.length === 0
    && Number.isFinite(checkedAt) && checkedAt <= now + 60_000
    && checkedAt + 24 * 60 * 60_000 > now
    && typeof match.statusText === "string" && match.statusText.trim().toLowerCase() === check.status;
  if (confirmed && check.status === "active") return { mark: "✓", text: "Active", description: "Confirmed active in the DORA research dataset", color: "text-green-800" };
  if (confirmed && check.status === "expired") return { mark: "×", text: "Expired", description: "Confirmed inactive (expired) in the DORA research dataset", color: "text-red-800" };
  const text = !check || check.outcome === "not_checked" && !check.matches?.length ? "Not checked"
    : check.outcome === "no_match" ? "No match"
      : check.outcome === "blocked" ? "Check blocked"
        : check.outcome === "unavailable" ? "Unavailable"
          : check.outcome === "error" ? "Check failed"
            : "Needs review";
  return { mark: "?", text, description: `Unresolved: ${text.toLowerCase()}. Licensing is not confirmed`, color: "text-gray-600" };
}

export function DoraLicenseMark({ check, label }: { check?: DoraCheck; label: string }) {
  const summary = licenseSummary(check);
  const description = `${label}: ${summary.description}`;
  return <span className={`inline-flex min-w-4 items-center justify-center text-sm font-semibold ${summary.color}`} role="img" aria-label={description} title={`${description}${check?.checkedAt ? ` · Checked ${check.checkedAt}` : ""}${check?.reasons?.length ? ` · ${check.reasons.join("; ")}` : ""}`}><span aria-hidden="true">{summary.mark}</span></span>;
}

export function DoraStatus({ check, label }: { check?: DoraCheck; label: string }) {
  const status = check?.status || "unknown";
  const text = status === "active" ? "Active" : status === "expired" ? "Expired" : status === "review" ? "Review" : "Unkwn";
  const color = status === "active" ? "text-green-800" : status === "expired" || status === "review" ? "text-amber-800" : "text-gray-500";
  return <span className={`whitespace-nowrap text-xs font-medium ${color}`} title={`${label}: ${text}${check?.checkedAt ? ` · Checked ${check.checkedAt}` : " · Not checked"}${check?.reasons?.length ? ` · ${check.reasons.join("; ")}` : ""}`} aria-label={`${label}: ${text}`}>{text}</span>;
}

function CheckedDate({ value }: { value?: string }) {
  return value ? <time dateTime={value}>{value.replace("T", " ").replace(/\.\d+Z$/, " UTC")}</time> : <>Unkwn</>;
}

export function DoraCheckDetails({ check, label }: { check?: DoraCheck; label: string }) {
  return <section className="min-w-0 rounded-lg border border-gray-200 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{label}</h3><DoraStatus check={check} label={label} /></div>
    <p className="mt-1 text-xs text-gray-500">Checked: <CheckedDate value={check?.checkedAt} /></p>
    {check?.attemptedAt ? <p className="text-xs text-gray-500">Last attempt: <CheckedDate value={check.attemptedAt} /></p> : null}
    {check?.sourceUrl ? <p className="text-xs"><SourceLink url={check.sourceUrl} label="DORA research dataset" /></p> : null}
    {check?.datasetUpdatedAt ? <p className="text-xs text-gray-500">Dataset updated: <CheckedDate value={check.datasetUpdatedAt} /></p> : null}
    {check?.matches?.length ? <ul className="mt-2 space-y-3 text-sm">{check.matches.map((match, index) => <li key={`${match.licenseNumber}:${index}`} className="border-t border-gray-100 pt-2">
      <div className="font-medium">{match.name}</div>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-gray-500">Type</dt><dd>{match.licenseType || "Unkwn"}</dd>
        <dt className="text-gray-500">Number</dt><dd>{match.licenseNumber || "Unkwn"}</dd>
        <dt className="text-gray-500">DORA status</dt><dd>{match.statusText || "Unkwn"}</dd>
        <dt className="text-gray-500">Expiration (source)</dt><dd>{match.expirationDate || "Unkwn"}</dd>
        <dt className="text-gray-500">Mailing location</dt><dd>{[match.city, match.state, match.postalCode].filter(Boolean).join(", ") || "Unkwn"}</dd>
        <dt className="text-gray-500">Source</dt><dd><SourceLink url={match.sourceUrl} label="DORA license lookup" />{match.datasetUrl ? <> · <SourceLink url={match.datasetUrl} label="Dataset" /></> : null}</dd>
      </dl>
      <details className="mt-2 text-xs"><summary className="cursor-pointer text-blue-700">Match evidence</summary><p className="mt-1">{match.identity === "corroborated" ? "Identity corroborated by independent identifiers." : "Possible match. Identity needs review."}</p><ul className="mt-1 list-inside list-disc">{[...match.basis, ...match.conflicts].map((reason, reasonIndex) => <li key={reasonIndex}>{reason}</li>)}</ul></details>
    </li>)}</ul> : <p className="mt-2 text-xs text-gray-500">{check?.outcome === "no_match" ? "No matching record found. Licensing remains unknown." : "No attributable DORA record collected."}</p>}
    {check?.reasons?.length || check?.conflicts?.length || check?.truncated ? <details className="mt-2 text-xs"><summary className="cursor-pointer text-blue-700">Check notes</summary><ul className="mt-1 list-inside list-disc">{[...(check?.reasons || []), ...(check?.conflicts || [])].map((reason, index) => <li key={index}>{reason}</li>)}{check?.truncated ? <li>Results are incomplete; review the official source.</li> : null}</ul></details> : null}
  </section>;
}

export default function DoraEvidence({ dora, catalogId, admin = false, compact = false, onUpdated }: { dora?: DoraCrossReference; catalogId?: string; admin?: boolean; compact?: boolean; onUpdated?: () => void }) {
  const [checked, setChecked] = useState<{ id: string; dora: DoraCrossReference } | null>(null);
  const [requestState, setRequestState] = useState<{ id?: string; pending: boolean; error: string }>({ pending: false, error: "" });
  const pending = requestState.id === catalogId && requestState.pending;
  const error = requestState.id === catalogId ? requestState.error : "";
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, [catalogId]);
  const current = checked && checked.id === catalogId ? checked.dora : dora;

  async function refresh() {
    if (!catalogId || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setRequestState({ id: catalogId, pending: true, error: "" });
    try {
      const response = await fetch("/api/catalog/dora/refresh", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ catalogIds: [catalogId] }), signal: controller.signal });
      const data = await response.json().catch(() => null);
      if (controller.signal.aborted || active.current !== controller) return;
      const result = data?.results?.find((item: { catalogId: string }) => item.catalogId === catalogId);
      if (!response.ok || !data?.ok || result?.error || !result?.dora) throw new Error(data?.message || result?.error || data?.error || "DORA check returned no result. Please retry.");
      setChecked({ id: catalogId, dora: result.dora });
      onUpdated?.();
    } catch (failure) {
      if (!controller.signal.aborted && active.current === controller) setRequestState({ id: catalogId, pending: false, error: failure instanceof Error ? failure.message : "DORA check failed." });
    } finally {
      if (active.current === controller) { active.current = null; setRequestState((previous) => ({ ...previous, pending: false })); }
    }
  }

  return <section className={compact ? "rounded-lg border border-gray-200 bg-white p-3" : "rounded-xl border border-blue-100 bg-white p-4"} aria-label="DORA cross-reference" aria-busy={pending}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">{compact ? "Licenses" : "DORA cross-reference"}</h2>{admin && catalogId ? <button type="button" disabled={pending} className="rounded border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 disabled:opacity-50" onClick={() => void refresh()}>{pending ? "Checking…" : "Check DORA"}</button> : null}</div>
    {!compact ? <p className="mt-1 text-xs text-gray-600">Person licenses and shop registrations are separate. The DORA research dataset is updated nightly; use the official lookup for current verification. A name or mailing-location match alone needs review. No match leaves licensing unknown.</p> : null}
    {pending ? <p className="mt-2 text-xs text-gray-600" role="status">Checking the DORA research dataset…</p> : null}
    {error ? <p className="mt-2 text-xs text-red-800" role="alert">{error} Previous results remain visible.</p> : null}
    {compact ? <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">{[
      { label: "Person license", check: current?.personLicense },
      { label: "Shop registration", check: current?.shopRegistration },
    ].map(({ label, check }) => <div key={label} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><dt className="text-gray-600">{label}</dt><dd className="flex items-center gap-1.5 font-medium"><DoraLicenseMark check={check} label={label} /><span>{licenseSummary(check).text}</span></dd></div>)}</dl>
      : <div className="mt-3 grid gap-3 md:grid-cols-2"><DoraCheckDetails check={current?.personLicense} label="Person license" /><DoraCheckDetails check={current?.shopRegistration} label="Shop registration" /></div>}
  </section>;
}
