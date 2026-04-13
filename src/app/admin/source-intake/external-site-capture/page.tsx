"use client";

import { AdminTopNav } from "@/components/admin/AdminTopNav";
import { ExternalSiteCapturePanel } from "@/components/admin/external-site-capture/ExternalSiteCapturePanel";

export default function Page() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <AdminTopNav />
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-950">External Site Capture</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Capture external salon pages and preview them inside a VMB framework.
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Paste a live GlossGenius or external salon URL to test capture, parsing, mapping, and VMB preview.
          </p>
        </div>

        <ExternalSiteCapturePanel />
      </div>
    </main>
  );
}
