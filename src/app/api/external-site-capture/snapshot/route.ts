import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { appendExternalSiteCaptureSnapshot } from "@/lib/external-site-capture/snapshot-store";
import type {
  ExternalSiteCaptureRequest,
  ExternalSiteCaptureSnapshot,
  ExternalSiteRawResult,
  ExtractedBusinessProfile,
  VmbMappedProfile,
} from "@/lib/external-site-capture/types";

export const runtime = "nodejs";

type SnapshotBody = {
  request?: ExternalSiteCaptureRequest;
  raw?: ExternalSiteRawResult;
  extracted?: ExtractedBusinessProfile;
  mapped?: VmbMappedProfile;
};

function makeId(input: string): string {
  return `esc_${crypto.createHash("md5").update(input).digest("hex").slice(0, 12)}`;
}

export async function POST(req: Request) {
  let body: SnapshotBody;
  try {
    body = (await req.json()) as SnapshotBody;
  } catch {
    return NextResponse.json({ ok: false as const, error: "invalid_json" }, { status: 400 });
  }

  if (!body.request || !body.raw || !body.extracted || !body.mapped) {
    return NextResponse.json({ ok: false as const, error: "snapshot_payload_required" }, { status: 400 });
  }

  try {
    const createdAt = new Date().toISOString();
    const snapshot: ExternalSiteCaptureSnapshot = {
      id: makeId(`${body.request.url}|${createdAt}`),
      createdAt,
      request: body.request,
      raw: body.raw,
      extracted: body.extracted,
      mapped: body.mapped,
    };
    const saved = await appendExternalSiteCaptureSnapshot(snapshot);
    return NextResponse.json({ ok: true as const, snapshot: saved });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "snapshot_save_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
