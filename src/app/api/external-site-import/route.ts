import { NextResponse } from "next/server";
import { createDraftProfileFromCapture } from "@/lib/external-site-import/create-draft-profile";
import { appendImportedProfileDraft, readImportedProfileDrafts } from "@/lib/external-site-import/store";
import type {
  ExternalSiteCaptureRequest,
  ExtractedBusinessProfile,
  VmbMappedProfile,
} from "@/lib/external-site-capture/types";

export const runtime = "nodejs";

type CreateDraftBody = {
  request?: ExternalSiteCaptureRequest;
  mapped?: VmbMappedProfile;
  extracted?: ExtractedBusinessProfile;
  snapshotId?: string;
  parseConfidence?: "High" | "Medium" | "Low";
};

export async function GET() {
  try {
    const drafts = await readImportedProfileDrafts();
    return NextResponse.json(
      { ok: true as const, drafts },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: CreateDraftBody;
  try {
    body = (await req.json()) as CreateDraftBody;
  } catch {
    return NextResponse.json({ ok: false as const, error: "invalid_json" }, { status: 400 });
  }

  if (!body.request || !body.mapped || !body.extracted) {
    return NextResponse.json({ ok: false as const, error: "draft_payload_required" }, { status: 400 });
  }

  try {
    const draft = createDraftProfileFromCapture({
      request: body.request,
      mapped: body.mapped,
      extracted: body.extracted,
      sourceSnapshotId: body.snapshotId,
      parseConfidence: body.parseConfidence,
    });
    await appendImportedProfileDraft(draft);
    return NextResponse.json({ ok: true as const, draft });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "draft_create_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
