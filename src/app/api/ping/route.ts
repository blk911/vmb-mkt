import { NextResponse } from "next/server";

/**
 * Lightweight health check. On Vercel, `VERCEL_GIT_COMMIT_SHA` is injected at build time
 * so you can confirm production matches GitHub (compare to `git rev-parse origin/main`).
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    ts: Date.now(),
    vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    vercelGitCommitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
  });
}
