import { RESOLVER_CATEGORY_LABELS } from "@/lib/unknown-resolver/resolver-categories";
import type { EnrichedResolverRow } from "@/lib/unknown-resolver/resolver-types";
import ResolverRecommendationBadge from "./ResolverRecommendationBadge";
import ResolverScoreBadge from "./ResolverScoreBadge";

type Props = {
  row: EnrichedResolverRow;
};

function SourceBadge({ source }: { source: string }) {
  return (
    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-neutral-700">
      {source}
    </span>
  );
}

export default function UnknownResolverDetailPanel({ row }: Props) {
  const { record, querySet, candidates, score } = row;

  return (
    <div className="space-y-4 border-t border-neutral-200 bg-neutral-50/50 px-3 py-3">
      <section>
        <h4 className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Record</h4>
        <dl className="mt-2 grid gap-1 text-xs text-neutral-800 sm:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Source name</dt>
            <dd>{record.sourceName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Normalized name</dt>
            <dd>{record.normalizedName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Category</dt>
            <dd>
              <span className="text-neutral-800">{RESOLVER_CATEGORY_LABELS[record.category]}</span>{" "}
              <span className="font-mono text-[10px] text-neutral-500">({record.category})</span>
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Address</dt>
            <dd>{[record.address, record.city, record.state, record.zip].filter(Boolean).join(", ") || "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Ring / distance</dt>
            <dd className="tabular-nums">
              {record.ring != null ? `${record.ring} mi` : "—"} · {record.distanceMiles != null ? `${record.distanceMiles.toFixed(2)} mi` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Source type / id</dt>
            <dd className="font-mono text-[11px]">
              {record.sourceType ?? "—"} · {record.sourceId ?? "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h4 className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Query set</h4>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] text-neutral-800">
          {querySet.queries.map((q, i) => (
            <li key={i} className="break-words">
              {q}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h4 className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Candidate evidence</h4>
        <ul className="mt-2 space-y-3">
          {candidates.map((c) => (
            <li key={c.id} className="rounded border border-neutral-200 bg-white p-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <SourceBadge source={c.source} />
                {c.confidence != null ? (
                  <span className="text-[10px] text-neutral-500">conf {Math.round(c.confidence * 100)}%</span>
                ) : null}
              </div>
              <div className="mt-1 font-semibold text-neutral-900">{c.title}</div>
              {c.snippet ? <p className="mt-1 text-[11px] leading-snug text-neutral-600">{c.snippet}</p> : null}
              {c.url ? (
                <p className="mt-1 truncate text-[11px] text-sky-700">
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                    {c.url}
                  </a>
                </p>
              ) : null}
              <dl className="mt-2 grid gap-0.5 text-[11px] text-neutral-700">
                <div>
                  <span className="text-neutral-500">Matched name: </span>
                  {c.matchedName ?? "—"}
                </div>
                <div>
                  <span className="text-neutral-500">Matched address: </span>
                  {c.matchedAddress ?? "—"}
                </div>
                <div>
                  <span className="text-neutral-500">Matched phone: </span>
                  {c.matchedPhone ?? "—"}
                </div>
                <div>
                  <span className="text-neutral-500">Evidence type: </span>
                  {c.evidenceType ?? "—"}
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h4 className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Score breakdown</h4>
        <dl className="mt-2 space-y-1 text-[11px] text-neutral-800">
          <div className="flex justify-between gap-2">
            <dt className="text-neutral-500">Name match</dt>
            <dd className="tabular-nums font-medium">{score.nameScore}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-neutral-500">Category match</dt>
            <dd className="tabular-nums font-medium">{score.categoryScore}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-neutral-500">Geo match</dt>
            <dd className="tabular-nums font-medium">{score.geoScore}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-neutral-500">Web presence</dt>
            <dd className="tabular-nums font-medium">{score.webPresenceScore}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-neutral-500">Platform signals</dt>
            <dd className="tabular-nums font-medium">{score.platformScore}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-neutral-500">Penalties</dt>
            <dd className="tabular-nums font-medium text-red-800">{score.conflictPenalty}</dd>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-neutral-200 pt-2">
            <dt className="font-semibold text-neutral-700">Final score</dt>
            <dd>
              <ResolverScoreBadge score={score.finalScore} />
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-neutral-500">Recommendation</dt>
            <dd>
              <ResolverRecommendationBadge recommendation={score.recommendation} />
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Reasoning</dt>
            <dd className="mt-1 text-[11px] leading-snug text-neutral-700">{score.reasoning}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
