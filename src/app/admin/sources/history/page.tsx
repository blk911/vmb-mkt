import Link from "next/link";
import { listSourceIntakes } from "@/lib/source-intake/store";
import type { SourceIntakeRecord } from "@/lib/source-intake/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Intake history · Sources" };

function submittedLabel(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso || "Unknown" : `${date.toLocaleString("en-US", { timeZone: "UTC" })} UTC`;
}

export default async function IntakeHistoryPage() {
  let intakes: SourceIntakeRecord[] = [];
  let unavailable = false;
  try {
    intakes = await listSourceIntakes();
  } catch {
    unavailable = true;
  }
  return <div className="mx-auto max-w-7xl space-y-5">
    <Link href="/admin/sources" className="text-sm text-slate-600 hover:underline">← Sources</Link>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Intake history</h1><p className="mt-1 text-sm text-slate-600">Past source submissions and their processing summaries. Open a submission to review its pending tasks.</p></div>
      <Link href="/admin/sources/import" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Import</Link>
    </div>
    {unavailable ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Intake history is unavailable. Reload this page to try again.</div> : <>
      <p className="text-sm text-slate-600">{intakes.length} intake submissions. Candidate counts describe parsed rows, not unique prospects.</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <caption className="sr-only">Source submissions, newest first, with candidate and processing counts.</caption>
          <thead className="bg-slate-50 text-xs text-slate-600"><tr>{["Submitted", "Source", "Status", "Parsed candidates", "Processing summary", "Review"].map((label) => <th scope="col" key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
          <tbody>{intakes.map((intake) => <tr key={intake.id} className="border-t border-slate-100">
            <td className="whitespace-nowrap px-4 py-3 align-top">{submittedLabel(intake.submittedAt)}</td>
            <td className="max-w-sm px-4 py-3 align-top"><div className="break-words font-medium">{intake.sourceLabel || intake.id}</div><div className="mt-1 text-xs text-slate-500">{intake.sourceType}</div></td>
            <td className="px-4 py-3 align-top">{intake.status}</td>
            <td className="px-4 py-3 align-top">{intake.parseSummary?.totalCandidates ?? "—"}</td>
            <td className="px-4 py-3 align-top text-xs text-slate-600">{intake.processSummary ? `${intake.processSummary.matchedCount} matched · ${intake.processSummary.newCandidateCount} new · ${intake.processSummary.heldCount} held` : "No processing summary"}</td>
            <td className="px-4 py-3 align-top"><Link href={`/admin/validate?${new URLSearchParams({ intakeId: intake.id })}`} className="whitespace-nowrap font-medium text-blue-700 hover:underline">Review submission</Link></td>
          </tr>)}{!intakes.length ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No source submissions yet.</td></tr> : null}</tbody>
        </table>
      </div>
    </>}
  </div>;
}
