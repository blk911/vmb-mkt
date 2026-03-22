import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms · VenMeBaby",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-neutral-900">Terms of use</h1>
      <p className="mt-4 text-sm text-neutral-600">
        This page is a placeholder for VenMeBaby terms of use. Replace with your organization&apos;s approved legal
        terms.
      </p>
    </div>
  );
}
