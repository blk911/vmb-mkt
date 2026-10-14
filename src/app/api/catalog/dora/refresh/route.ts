import { NextResponse } from "next/server";
import { canAccessAdmin, getSessionUserFromCookieHeader } from "@/lib/auth/access";
import { refreshCatalogDora } from "@/lib/dora/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function POST(req: Request) {
  const user = await getSessionUserFromCookieHeader(req.headers.get("cookie") || "");
  if (!canAccessAdmin(user)) return NextResponse.json({ ok: false, error: user ? "forbidden" : "unauthorized" }, { status: user ? 403 : 401, headers });
  const requestUrl = new URL(req.url);
  // Next's Node adapter can expose an internal URL hostname. Compare with the
  // actual request Host as well, which browser JavaScript cannot override.
  const host = req.headers.get("host") || requestUrl.host;
  let expectedOrigin = "";
  try { if (/^[a-z0-9.[\]:-]+$/i.test(host)) expectedOrigin = new URL(`${requestUrl.protocol}//${host}`).origin; } catch { /* Malformed Host is rejected. */ }
  if (!expectedOrigin || req.headers.get("origin") !== expectedOrigin) {
    return NextResponse.json({ ok: false, error: "forbidden_origin" }, { status: 403, headers });
  }
  if (req.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return NextResponse.json({ ok: false, error: "json_required" }, { status: 415, headers });
  }
  try {
    const reader = req.body?.getReader();
    if (!reader) throw new Error("invalid_request");
    const parts: Uint8Array[] = []; let length = 0;
    while (true) {
      const item = await reader.read(); if (item.done) break;
      length += item.value.length;
      if (length > 8192) { await reader.cancel(); return NextResponse.json({ ok: false, error: "request_too_large" }, { status: 413, headers }); }
      parts.push(item.value);
    }
    const body: unknown = JSON.parse(Buffer.concat(parts).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => key !== "catalogIds")) throw new Error("invalid_request");
    const keys = (body as { catalogIds?: unknown }).catalogIds;
    if (!Array.isArray(keys) || !keys.length || keys.length > 10
      || keys.some((key) => typeof key !== "string" || key.length > 512 || !/^(provider:adminPipelineParsedCandidates:|business:tech_index:).+/.test(key) || /[\u0000-\u001f]/.test(key))) throw new Error("invalid_request");
    const results = await refreshCatalogDora(keys);
    return NextResponse.json({ ok: true, results }, { headers });
  } catch (error) {
    const invalid = error instanceof SyntaxError || error instanceof Error && ["invalid_request", "invalid_catalog_ids"].includes(error.message);
    return NextResponse.json({ ok: false, error: invalid ? "invalid_request" : "dora_refresh_unavailable" }, { status: invalid ? 400 : 503, headers });
  }
}
