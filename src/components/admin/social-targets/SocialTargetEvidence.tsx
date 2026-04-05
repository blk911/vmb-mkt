"use client";

import { useState } from "react";
import {
  buildEvidenceDetailLine,
  buildEvidenceHeadline,
  buildEvidenceTail,
  legacyHealthHint,
} from "@/lib/social-targets/operator-evidence";
import { getFeaturedValidationIntegrity } from "@/lib/social-targets/featured-validation-integrity";
import { isConfirmedRealNoSocial } from "@/lib/social-targets/operator-rank";
import type { SocialTarget } from "@/types/social-target";

type Props = { target: SocialTarget };

/** Compact reasoning for trust/rank; expandable for evidence strings. */
export function SocialTargetEvidence({ target }: Props) {
  const [open, setOpen] = useState(false);
  const integrity = getFeaturedValidationIntegrity(target);
  const head = buildEvidenceHeadline(target);
  const detail = buildEvidenceDetailLine(target);
  const tail = buildEvidenceTail(target);
  const hint = legacyHealthHint(target);
  const noSocialAnchorHint = isConfirmedRealNoSocial(target)
    ? "Real business anchor confirmed; no verified social footprint."
    : null;
  const hasGoogleDiscoverySource = (target.socialCandidates ?? []).some((candidate) =>
    (candidate.evidence ?? []).some((line) => line.toLowerCase().includes("source google"))
  );
  const integrityLine =
    integrity.reason && integrity.reason !== "Featured profile verified and fresh" ? integrity.reason : null;
  const extra = [...(hint ? [hint] : []), ...(integrityLine ? [integrityLine] : []), ...tail];
  const evidence = Array.isArray(target.evidence) ? [...target.evidence] : [];
  const groupedEvidence = evidence
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 10)
    .reduce<Record<string, typeof evidence>>((acc, item) => {
      const key = `${item.type}:${item.platform ?? "unknown"}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  const resolution = (target.resolutionStatus ?? "unknown").toUpperCase();
  const resolutionTone =
    target.resolutionStatus === "resolved"
      ? "bg-emerald-100 text-emerald-900"
      : target.resolutionStatus === "partial"
        ? "bg-amber-100 text-amber-900"
        : target.resolutionStatus === "conflict"
          ? "bg-rose-100 text-rose-900"
          : "bg-neutral-100 text-neutral-700";
  const confidenceLabel =
    typeof target.confidenceScore === "number" && Number.isFinite(target.confidenceScore)
      ? `${Math.max(0, Math.min(100, Math.round(target.confidenceScore)))}`
      : "—";
  const addressExpansion = target.addressExpansion;
  const expansionSummary =
    addressExpansion && addressExpansion.classification
      ? `Address expansion: ${addressExpansion.classification.isLikelyMultiTenant ? "multi-tenant likely" : "single/unknown"}, density ${
          addressExpansion.classification.addressDensityScore
        }, candidates ${addressExpansion.candidateCount ?? addressExpansion.candidates?.length ?? 0}`
      : null;

  return (
    <div className="mt-1 max-w-[340px] text-[10px] leading-snug text-neutral-600">
      {noSocialAnchorHint ? <p className="mb-0.5 text-neutral-700">{noSocialAnchorHint}</p> : null}
      {hasGoogleDiscoverySource ? <p className="mb-0.5 text-neutral-700">Source: Google discovery (query-based)</p> : null}
      {expansionSummary ? <p className="mb-0.5 text-neutral-700">{expansionSummary}</p> : null}
      <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${resolutionTone}`}>{resolution}</span>
        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-900">
          CONF {confidenceLabel}
        </span>
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-neutral-700">
          EV {(target.evidence ?? []).length}
        </span>
      </div>
      <p className="text-neutral-700">{head}</p>
      {detail ? <p className="mt-0.5 text-neutral-500">{detail}</p> : null}
      {extra.length > 0 || evidence.length > 0 ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-0.5 text-[9px] font-semibold text-sky-800 underline-offset-2 hover:underline"
        >
          {open ? "Hide evidence" : "Why? + evidence"}
        </button>
      ) : null}
      {open ? (
        <div className="mt-1 space-y-1.5">
          {Object.entries(groupedEvidence).map(([groupKey, items]) => {
            const [type, platform] = groupKey.split(":");
            return (
              <div key={groupKey} className="rounded border border-neutral-200 bg-white p-1">
                <div className="mb-0.5 flex flex-wrap items-center gap-1">
                  <span className="rounded bg-neutral-100 px-1 py-0.5 text-[9px] font-bold uppercase text-neutral-700">
                    {type.replace(/_/g, " ")}
                  </span>
                  {platform !== "unknown" ? (
                    <span className="rounded bg-indigo-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-indigo-900">
                      {platform}
                    </span>
                  ) : null}
                </div>
                <ul className="space-y-0.5">
                  {items.slice(0, 2).map((item) => (
                    <li key={item.id} className="text-[9px] text-neutral-600">
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className={`rounded px-1 py-0.5 font-bold uppercase ${
                            item.confidence === "high"
                              ? "bg-emerald-100 text-emerald-900"
                              : item.confidence === "medium"
                                ? "bg-amber-100 text-amber-900"
                                : "bg-neutral-100 text-neutral-700"
                          }`}
                        >
                          {item.confidence === "high" ? "HIGH" : item.confidence === "medium" ? "MED" : "LOW"}
                        </span>
                        <span>sim {item.matchSignals.nameSimilarity.toFixed(2)}</span>
                        <span>{item.matchSignals.geoMatch ? "geo:yes" : "geo:no"}</span>
                        {item.extracted.handle ? <span>@{item.extracted.handle.replace(/^@/, "")}</span> : null}
                        {item.extracted.phone ? <span>{item.extracted.phone}</span> : null}
                        {item.extracted.email ? <span>{item.extracted.email}</span> : null}
                        {item.domainType ? <span>{item.domainType.replace(/_/g, " ")}</span> : null}
                        {item.addressLink ? <span>addr: {item.addressLink}</span> : null}
                      </div>
                      {item.url ? <p className="truncate text-[9px] text-neutral-500">{item.url}</p> : null}
                      {item.title ? <p className="truncate text-[9px] text-neutral-500">{item.title}</p> : null}
                      {item.snippet ? <p className="truncate text-[9px] text-neutral-500">{item.snippet}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {extra.length > 0 ? (
            <ul className="list-inside list-disc space-y-0.5 text-[9px] text-neutral-500">
              {extra.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
