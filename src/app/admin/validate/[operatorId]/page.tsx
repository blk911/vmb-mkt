import Link from "next/link";
import { notFound } from "next/navigation";
import ValidateDetailActions from "@/components/admin/pipeline/ValidateDetailActions";
import { getValidationDetail } from "@/lib/admin/pipeline/validation";

const TERMINAL_STATUSES = new Set(["approved", "merged", "rejected", "failed", "dismissed"]);

export default async function OperatorDetail({ params }: { params: Promise<{ operatorId: string }> }) {
  const { operatorId } = await params;
  const detail = await getValidationDetail(decodeURIComponent(operatorId || ""));

  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{detail.row.displayName}</h1>
          <p className="mt-1 text-sm text-gray-600">
            Validation review key {detail.row.reviewKey}
          </p>
        </div>
        <Link href="/admin/validate" className="text-sm text-blue-600 hover:underline">
          Back to queue
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-xl bg-white p-4 shadow">
          <h2 className="font-bold">Operator Profile</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-gray-500">Name</dt>
              <dd>{detail.row.displayName}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Location</dt>
              <dd>{[detail.row.city, detail.row.state].filter(Boolean).join(", ") || "Unknown"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Validation Lanes</dt>
              <dd className="flex flex-wrap gap-2">
                {detail.row.lanes.map((lane) => (
                  <LaneBadge key={lane} lane={lane} />
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Lane Status</dt>
              <dd>
                {detail.row.lanes.map((lane) => (
                  <div key={lane}>
                    {lane}: {detail.row.laneStatuses[lane] || "pending"}
                  </div>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Confidence</dt>
              <dd>{detail.row.confidence}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl bg-white p-4 shadow">
          <h2 className="font-bold">Evidence</h2>
          <div className="mt-3 space-y-3 text-sm">
            {detail.intake ? (
              <div>
                <div className="font-medium">Intake</div>
                <div>{detail.intake.sourceLabel}</div>
                <div className="text-gray-500">{detail.intake.sourceType}</div>
                {detail.intake.sourceUrl ? (
                  <a className="text-blue-600 hover:underline" href={detail.intake.sourceUrl} target="_blank" rel="noreferrer">
                    {detail.intake.sourceUrl}
                  </a>
                ) : null}
              </div>
            ) : null}

            {detail.candidate ? (
              <div>
                <div className="font-medium">Parsed Candidate</div>
                <div>{detail.candidate.displayName}</div>
                {detail.candidate.roleLabel ? <div>Role: {detail.candidate.roleLabel}</div> : null}
                {detail.candidate.priceText ? <div>Price: {detail.candidate.priceText}</div> : null}
                {detail.candidate.parseWarnings?.length ? (
                  <div className="text-amber-700">Warnings: {detail.candidate.parseWarnings.join(", ")}</div>
                ) : null}
              </div>
            ) : null}

            {detail.candidate &&
            (detail.candidate.instagramHandle ||
              detail.candidate.instagramProfileUrl ||
              detail.candidate.signalType ||
              detail.candidate.serviceHint ||
              detail.candidate.geoHint ||
              detail.candidate.captionSnippet) ? (
              <div>
                <div className="font-medium">Instagram Attribution Context</div>
                <div className="text-xs text-amber-700">
                  Supplemental only. This reviewer context does not change canonical validation state or actions.
                </div>
                <dl className="mt-2 space-y-1">
                  {detail.candidate.instagramHandle ? (
                    <div>
                      <dt className="text-gray-500">Handle</dt>
                      <dd>@{detail.candidate.instagramHandle.replace(/^@/, "")}</dd>
                    </div>
                  ) : null}
                  {detail.candidate.instagramProfileUrl ? (
                    <div>
                      <dt className="text-gray-500">Profile URL</dt>
                      <dd>
                        <a className="text-blue-600 hover:underline" href={detail.candidate.instagramProfileUrl} target="_blank" rel="noreferrer">
                          {detail.candidate.instagramProfileUrl}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  {detail.candidate.signalType ? (
                    <div>
                      <dt className="text-gray-500">Signal Type</dt>
                      <dd>{detail.candidate.signalType}</dd>
                    </div>
                  ) : null}
                  {detail.candidate.serviceHint ? (
                    <div>
                      <dt className="text-gray-500">Service Hint</dt>
                      <dd>{detail.candidate.serviceHint}</dd>
                    </div>
                  ) : null}
                  {detail.candidate.geoHint ? (
                    <div>
                      <dt className="text-gray-500">Geo Hint</dt>
                      <dd>{detail.candidate.geoHint}</dd>
                    </div>
                  ) : null}
                  {detail.candidate.captionSnippet ? (
                    <div>
                      <dt className="text-gray-500">Caption Snippet</dt>
                      <dd>{detail.candidate.captionSnippet}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : null}

            <div>
              <div className="font-medium">Validation Lanes</div>
              <div className="mt-2 space-y-3">
                {detail.lanes.map((lane) => (
                  <div key={lane.queueItemId} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <LaneBadge lane={lane.sourceType} />
                      <span className="font-mono text-xs text-gray-500">{lane.queueItemId}</span>
                    </div>
                    <div className="mt-2 text-gray-700">Status: {lane.status}</div>
                    {lane.resultSummary ? (
                      <div className="mt-2">
                        <div className="font-medium">{lane.resultSummary.title}</div>
                        <ul className="mt-1 space-y-1 text-gray-700">
                          {lane.resultSummary.lines.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="mt-2 text-gray-500">No resolved evidence yet for this lane.</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-white p-4 shadow">
          <h2 className="font-bold">Historical Processing Context</h2>
          <p className="mt-1 text-sm text-amber-700">
            Supplemental / historical only. This context does not change canonical validation state or review actions.
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-gray-500">Receipt</dt>
              <dd>{detail.historicalProcessing?.present ? "Present" : "Absent"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Processed At</dt>
              <dd>{detail.historicalProcessing?.processedAt || "No historical processing receipt found for this intake."}</dd>
            </div>
            {detail.historicalProcessing?.present ? (
              <div>
                <dt className="text-gray-500">Summary</dt>
                <dd>
                  matched {detail.historicalProcessing.matchedCount || 0} · new {detail.historicalProcessing.newCandidateCount || 0} · held{" "}
                  {detail.historicalProcessing.heldCount || 0}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        {detail.candidate?.rawBlock ? (
          <section className="rounded-xl bg-white p-4 shadow xl:col-span-2">
            <h2 className="font-bold">Raw Candidate Block</h2>
            <pre className="mt-3 whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700">{detail.candidate.rawBlock}</pre>
          </section>
        ) : null}

        <section className="rounded-xl bg-white p-4 shadow xl:col-span-2">
          <h2 className="font-bold">Review Actions</h2>
          <p className="mt-1 text-sm text-gray-600">Underlying queue items remain separate. Review actions below still submit to each lane&apos;s existing resolve endpoint.</p>
          <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
            {detail.lanes.map((lane) => (
              <div key={lane.queueItemId} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <LaneBadge lane={lane.sourceType} />
                  <span className="font-mono text-xs text-gray-500">{lane.queueItemId}</span>
                </div>
                {TERMINAL_STATUSES.has(lane.status) ? (
                  <p className="text-sm text-gray-500">This lane is already resolved and no longer accepts review actions.</p>
                ) : (
                  <ValidateDetailActions
                    queueItemId={lane.queueItemId}
                    displayName={`${detail.row.displayName} (${lane.sourceType})`}
                    resolveEndpoint={lane.resolveEndpoint}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function LaneBadge({ lane }: { lane: "DORA" | "SOCIAL" }) {
  const className =
    lane === "DORA"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-purple-200 bg-purple-50 text-purple-700";
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}>{lane}</span>;
}
