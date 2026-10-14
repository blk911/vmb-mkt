import Link from "next/link";
export const dynamic = "force-dynamic";
export default function ActivatePage() {
  return <div className="space-y-5">
    <h1 className="text-xl font-bold">Outreach preparation</h1>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <h2 className="font-semibold">Sending is not connected</h2>
      <p className="mt-2 text-sm">Shared lists are ready for selection and follow-up planning. No messages or campaigns are sent from this app, and saving a list does not create campaign recipients.</p>
      <p className="mt-2 text-sm">Use a fixed list to preserve an explicit selection. Saved-filter lists update as catalog records change. Existing outreach queue records remain preserved; they have not been converted into a sent campaign.</p>
    </div>
    <Link className="inline-block rounded bg-black px-4 py-2 text-white" href="/admin/lists">Open My lists</Link>
  </div>;
}
