import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy · VenMeBaby",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-neutral-900">Privacy</h1>
      <p className="mt-4 text-sm text-neutral-600">
        This page is a placeholder for the VenMeBaby privacy policy. Replace with your organization&apos;s approved
        policy text.
      </p>
    </div>
  );
}
