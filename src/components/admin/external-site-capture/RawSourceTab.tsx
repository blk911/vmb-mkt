"use client";

import type { ExternalSiteRawResult } from "@/lib/external-site-capture/types";

type RawSourceTabProps = {
  raw: ExternalSiteRawResult | null;
};

export function RawSourceTab({ raw }: RawSourceTabProps) {
  if (!raw) {
    return <p className="text-sm text-neutral-500">No raw capture yet.</p>;
  }

  const htmlPreview = raw.html.slice(0, 8000);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm text-sm">
        <div><span className="font-medium text-neutral-800">Title:</span> {raw.title || "n/a"}</div>
        <div><span className="font-medium text-neutral-800">Meta Description:</span> {raw.metaDescription || "n/a"}</div>
        <div><span className="font-medium text-neutral-800">Final URL:</span> <span className="break-all">{raw.finalUrl}</span></div>
        <div><span className="font-medium text-neutral-800">Fetched At:</span> {new Date(raw.fetchedAt).toLocaleString()}</div>
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-3 text-sm font-medium text-neutral-800">HTML Preview</div>
        <pre className="max-h-[520px] overflow-auto rounded-xl bg-neutral-950 p-4 text-xs text-neutral-100 whitespace-pre-wrap">
          {htmlPreview}
        </pre>
      </div>
    </div>
  );
}
