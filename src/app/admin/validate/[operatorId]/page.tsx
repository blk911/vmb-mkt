import Link from "next/link";
import { notFound } from "next/navigation";
import ValidateDetailActions from "@/components/admin/pipeline/ValidateDetailActions";
import { getValidationDetail } from "@/lib/admin/pipeline/validation";

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
            {detail.row.sourceType} queue item {detail.row.queueItemId}
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
              <dt className="text-gray-500">Source</dt>
              <dd>{detail.row.sourceType}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd>{detail.row.status}</dd>
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

            {detail.resultSummary ? (
              <div>
                <div className="font-medium">{detail.resultSummary.title}</div>
                <ul className="mt-1 space-y-1 text-gray-700">
                  {detail.resultSummary.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-gray-500">No resolved evidence yet for this queue item.</div>
            )}
          </div>
        </section>

        {detail.candidate?.rawBlock ? (
          <section className="rounded-xl bg-white p-4 shadow xl:col-span-2">
            <h2 className="font-bold">Raw Candidate Block</h2>
            <pre className="mt-3 whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700">{detail.candidate.rawBlock}</pre>
          </section>
        ) : null}

        <section className="rounded-xl bg-white p-4 shadow xl:col-span-2">
          <h2 className="font-bold">Review Actions</h2>
          <div className="mt-3">
            <ValidateDetailActions
              queueItemId={detail.row.queueItemId}
              displayName={detail.row.displayName}
              resolveEndpoint={detail.resolveEndpoint}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
