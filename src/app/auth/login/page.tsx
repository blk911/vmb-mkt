"use client";

import Link from "next/link";
import { Suspense } from "react";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function sanitizeNextPath(nextPath?: string | null) {
  const value = String(nextPath || "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/admin/markets";
  }
  if (value === "/auth/login" || value.startsWith("/auth/login?")) {
    return "/admin/markets";
  }
  return value;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const nextPath = sanitizeNextPath(searchParams.get("next"));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, pass, next: nextPath }),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; next?: string };
      if (!res.ok || !body.ok) {
        setError(body.error === "invalid_credentials" ? "Invalid username or password." : "Login failed.");
        return;
      }
      router.replace(body.next || nextPath);
      router.refresh();
    } catch {
      setError("Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Secure Sign In</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Continue into the protected VMB workspace for targets, reviews, and admin workflows.
      </p>

      <label className="mt-5 block text-sm font-medium text-neutral-800">
        Username
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          autoComplete="username"
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-neutral-300 focus:ring-2"
          required
        />
      </label>

      <label className="mt-4 block text-sm font-medium text-neutral-800">
        Password
        <input
          type={showPass ? "text" : "password"}
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-neutral-300 focus:ring-2"
          required
        />
      </label>

      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-neutral-700">
        <input
          type="checkbox"
          checked={showPass}
          onChange={(e) => setShowPass(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
        />
        Show password
      </label>

      {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60"
      >
        {loading ? "Signing In..." : "Sign In"}
      </button>

      <p className="mt-4 text-center text-xs text-neutral-500">
        Need the product overview first?{" "}
        <Link href="/" className="font-medium text-neutral-700 underline underline-offset-4">
          Return to the access page
        </Link>
        . Need credentials?{" "}
        <Link href="/access/request" className="font-medium text-neutral-700 underline underline-offset-4">
          Request access
        </Link>
        .
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <Suspense fallback={<div className="text-sm text-neutral-600">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}

