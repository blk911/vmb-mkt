"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

const ROLE_OPTIONS = [
  { value: "external", label: "External access" },
  { value: "member", label: "Internal operator access" },
];

export default function RequestAccessPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    organization: "",
    requestedRole: "external",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const canSubmit = useMemo(() => {
    return !!form.name.trim() && !!form.email.trim() && !!form.organization.trim();
  }, [form.email, form.name, form.organization]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setStatus("idle");
    setMessage("");

    try {
      const res = await fetch("/api/access/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setStatus("error");
        setMessage(body.error === "invalid_email" ? "Enter a valid email address." : "Request failed.");
        return;
      }

      setStatus("success");
      setMessage("Access request received. A VMB administrator can review it from the internal workspace.");
      setForm({
        name: "",
        email: "",
        organization: "",
        requestedRole: "external",
        notes: "",
      });
    } catch {
      setStatus("error");
      setMessage("Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white px-4 py-10">
      <section className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="rounded-3xl border border-neutral-200 bg-neutral-950 p-8 text-white shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">Request Access</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Tell us how you need to use VenMeBaby.</h1>
          <p className="mt-4 text-sm leading-6 text-neutral-300">
            Use this form if you need invited access to the product domain. Internal operator tooling stays protected,
            and requests can be triaged before credentials are issued.
          </p>
          <div className="mt-8 space-y-3 text-sm text-neutral-300">
            <p>Use this for partner visibility, invited external access, or internal operator onboarding.</p>
            <p>Need immediate internal entry? Existing users can go straight to sign in.</p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950"
            >
              Secure Sign In
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Back to access page
            </Link>
          </div>
        </aside>

        <form onSubmit={onSubmit} className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">Access Request Form</h2>
          <p className="mt-2 text-sm text-neutral-600">Submit the basics and the team can route you correctly.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-neutral-800">
              Full name
              <input
                value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-neutral-300 focus:ring-2"
                required
              />
            </label>
            <label className="block text-sm font-medium text-neutral-800">
              Work email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-neutral-300 focus:ring-2"
                required
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-neutral-800">
              Organization
              <input
                value={form.organization}
                onChange={(e) => setForm((current) => ({ ...current, organization: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-neutral-300 focus:ring-2"
                required
              />
            </label>
            <label className="block text-sm font-medium text-neutral-800">
              Requested access
              <select
                value={form.requestedRole}
                onChange={(e) => setForm((current) => ({ ...current, requestedRole: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-neutral-300 focus:ring-2"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-4 block text-sm font-medium text-neutral-800">
            Notes
            <textarea
              rows={6}
              value={form.notes}
              onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-neutral-300 focus:ring-2"
              placeholder="Who needs access, what market or workflow they support, and any time-sensitive context."
            />
          </label>

          {status !== "idle" ? (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                status === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60"
          >
            {loading ? "Submitting..." : "Submit request"}
          </button>
        </form>
      </section>
    </main>
  );
}
