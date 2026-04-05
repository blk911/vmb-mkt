import { NextResponse } from "next/server";
import { batchIngestSourceCandidateInputs } from "@/lib/social-targets/batch-ingest";
import type { BatchIngestPayload } from "@/lib/social-targets/batch-ingest-types";
import { assertSocialTargetsApiAccess } from "@/lib/social-targets/social-targets-api-access";
import { getMergedSocialTargets, saveMergedSocialTargetsAsRuntime } from "@/lib/social-targets/social-targets-store";
import type { SourceCandidateInput } from "@/lib/social-targets/source-adapters";

function isSourceType(v: unknown): v is SourceCandidateInput["sourceType"] {
  return v === "google_maps" || v === "google" || v === "yelp" || v === "dora" || v === "website";
}

function isTrustTier(v: unknown): v is SourceCandidateInput["sourceTrustTier"] {
  return v === "tier1" || v === "tier2" || v === "tier3";
}

function normalizeInput(raw: unknown): SourceCandidateInput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isSourceType(o.sourceType) || !isTrustTier(o.sourceTrustTier)) return null;
  const input: SourceCandidateInput = {
    sourceType: o.sourceType,
    sourceTrustTier: o.sourceTrustTier,
  };
  const stringFields: Array<keyof SourceCandidateInput> = [
    "sourceUrl",
    "sourceLabel",
    "businessName",
    "personName",
    "phone",
    "website",
    "domain",
    "address",
    "city",
    "state",
    "postalCode",
    "zone",
    "category",
    "subcategory",
    "handle",
    "profileUrl",
    "rawSourceId",
    "rawSourceType",
  ];
  for (const field of stringFields) {
    const value = o[field];
    if (typeof value === "string" && value.trim()) input[field] = value.trim();
  }
  if (Array.isArray(o.alternateNames)) {
    input.alternateNames = o.alternateNames.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  }
  if (Array.isArray(o.evidence)) {
    input.evidence = o.evidence.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  }
  if (Array.isArray(o.notes)) {
    input.notes = o.notes.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  }
  if (typeof o.anchorHint === "boolean") input.anchorHint = o.anchorHint;
  if (typeof o.territoryHint === "boolean") input.territoryHint = o.territoryHint;
  if (o.liveHint === "live" || o.liveHint === "dead" || o.liveHint === "unknown") input.liveHint = o.liveHint;
  if (
    o.platform === "instagram" ||
    o.platform === "tiktok" ||
    o.platform === "linktree" ||
    o.platform === "website" ||
    o.platform === "booking" ||
    o.platform === "unknown"
  ) {
    input.platform = o.platform;
  }
  return input;
}

function normalizePayload(raw: unknown): BatchIngestPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.inputs)) return null;
  const inputs = o.inputs.map(normalizeInput).filter((x): x is SourceCandidateInput => x !== null);
  if (inputs.length === 0) return null;
  const payload: BatchIngestPayload = { inputs };
  if (typeof o.targetId === "string" && o.targetId.trim()) payload.targetId = o.targetId.trim();
  if (typeof o.sourceBatchLabel === "string" && o.sourceBatchLabel.trim()) payload.sourceBatchLabel = o.sourceBatchLabel.trim();
  if (o.mode === "review_seed" || o.mode === "attach_only" || o.mode === "best_effort") payload.mode = o.mode;
  return payload;
}

export async function POST(req: Request) {
  const denied = await assertSocialTargetsApiAccess(req);
  if (denied) return denied;
  try {
    const body: unknown = await req.json();
    const payload = normalizePayload(body);
    if (!payload) {
      return NextResponse.json({ ok: false, error: "expected { inputs: SourceCandidateInput[] }" }, { status: 400 });
    }
    const targets = await getMergedSocialTargets();
    const out = batchIngestSourceCandidateInputs(targets, payload);
    await saveMergedSocialTargetsAsRuntime(out.targets);
    return NextResponse.json({
      ok: true as const,
      summary: out.summary,
      results: out.results,
      targets: out.targets.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
  }
}

