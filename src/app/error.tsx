"use client";

import { useEffect } from "react";

/**
 * Segment error boundary — avoids a blank screen when a server component fails.
 * For fatal root failures use `global-error.tsx` (with html/body).
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app error]", error?.digest, error?.message);
  }, [error]);

  return (
    <div className="min-h-[40vh] bg-neutral-50 p-8 text-neutral-900">
      <div className="mx-auto max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-neutral-600">
          A server error occurred while loading this page. You can try again, or open the site from a fresh tab.
        </p>
        {error?.digest ? (
          <p className="mt-3 font-mono text-xs text-neutral-500">Digest: {error.digest}</p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
            onClick={() => reset()}
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}
