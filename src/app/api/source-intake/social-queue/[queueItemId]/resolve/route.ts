import { NextResponse } from "next/server";
import { canAccessAdmin, getSessionUserFromCookieHeader } from "@/lib/auth/access";
import { findSocialResultByQueueItemId } from "@/lib/source-intake/phase2-store";
import { resolveSocialQueueItem } from "@/lib/source-intake/social-resolver";
import type { ValidationReviewOutcome } from "@/lib/source-intake/phase2-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

type ResolveBody = {
  action?: ValidationReviewOutcome;
  mergeTargetId?: string;
};

function isAction(value: unknown): value is ValidationReviewOutcome {
  return value === "approved" || value === "merged" || value === "rejected";
}

export async function POST(req: Request, ctx: { params: Promise<{ queueItemId: string }> }) {
  const user = await getSessionUserFromCookieHeader(req.headers.get("cookie") || "");
  if (!canAccessAdmin(user)) {
    return NextResponse.json({ ok: false, error: user ? "forbidden" : "unauthorized" }, { status: user ? 403 : 401, headers });
  }
  const requestUrl = new URL(req.url);
  // Next's Node adapter may expose an internal URL host. The request Host is
  // the browser-facing authority and cannot be overridden by browser scripts.
  const host = req.headers.get("host") || requestUrl.host;
  let expectedOrigin = "";
  try {
    if (/^[a-z0-9.[\]:-]+$/i.test(host)) expectedOrigin = new URL(`${requestUrl.protocol}//${host}`).origin;
  } catch { /* Malformed Host is rejected. */ }
  if (!expectedOrigin || req.headers.get("origin") !== expectedOrigin) {
    return NextResponse.json({ ok: false, error: "forbidden_origin" }, { status: 403, headers });
  }
  if (req.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return NextResponse.json({ ok: false, error: "json_required" }, { status: 415, headers });
  }

  try {
    const reader = req.body?.getReader();
    if (!reader) return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400, headers });
    const parts: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      length += item.value.length;
      if (length > 8192) {
        await reader.cancel();
        return NextResponse.json({ ok: false, error: "request_too_large" }, { status: 413, headers });
      }
      parts.push(item.value);
    }
    const value: unknown = JSON.parse(Buffer.concat(parts).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).some((key) => key !== "action" && key !== "mergeTargetId")) {
      return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400, headers });
    }
    const body = value as ResolveBody;
    const { queueItemId } = await ctx.params;
    const id = decodeURIComponent(queueItemId || "").trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: "missing_queueItemId" }, { status: 400, headers });
    }
    if (body.action !== undefined && !isAction(body.action)) {
      return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400, headers });
    }
    if (body.mergeTargetId !== undefined && typeof body.mergeTargetId !== "string") {
      return NextResponse.json({ ok: false, error: "invalid_mergeTargetId" }, { status: 400, headers });
    }
    if (body.action === "merged" && !body.mergeTargetId?.trim()) {
      return NextResponse.json({ ok: false, error: "mergeTargetId_required" }, { status: 400, headers });
    }
    if (body.action !== "merged" && body.mergeTargetId !== undefined) {
      return NextResponse.json({ ok: false, error: "mergeTargetId_requires_merged_action" }, { status: 400, headers });
    }

    const existing = await findSocialResultByQueueItemId(id);
    if (existing && !body.action) {
      return NextResponse.json({ ok: true, result: existing }, { headers });
    }

    const result = await resolveSocialQueueItem(id, {
      action: body.action,
      mergeTargetId: body.mergeTargetId,
      resolvedBy: user!.username,
    });
    return NextResponse.json({ ok: true, result }, { headers });
  } catch (error: unknown) {
    const invalid = error instanceof SyntaxError || error instanceof URIError;
    return NextResponse.json(
      { ok: false, error: invalid ? "invalid_request" : "resolution_unavailable" },
      { status: invalid ? 400 : 503, headers }
    );
  }
}
