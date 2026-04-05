import { NextResponse } from "next/server";
import { runAddressExpansion, type AddressExpansionQueryResultSet } from "@/lib/social-targets/address-expansion/run-address-expansion";
import { assertSocialTargetsApiAccess } from "@/lib/social-targets/social-targets-api-access";
import { getMergedSocialTargets, saveMergedSocialTargetsAsRuntime } from "@/lib/social-targets/social-targets-store";
import { normalizeSocialTarget } from "@/lib/social-targets/normalization";

type BodyShape = {
  targetIds?: string[];
  address?: string;
  normalizedAddress?: string;
  runType?: "validation" | "scale" | "adhoc" | "expansion_test";
  sourceVersion?: string;
  queryResultsByTarget?: Record<string, AddressExpansionQueryResultSet[]>;
};

function asCleanStrings(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function runIdFromAddress(address?: string, sourceVersion = "address-expansion-v1"): string {
  const date = new Date().toISOString().slice(0, 10);
  const base = (address ?? "address")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return `${base || "address"}-${date}-${sourceVersion}-${shortId()}`;
}

function normalizeBody(raw: unknown): BodyShape {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const runType =
    o.runType === "validation" || o.runType === "scale" || o.runType === "adhoc" || o.runType === "expansion_test"
      ? o.runType
      : undefined;
  return {
    targetIds: asCleanStrings(o.targetIds),
    ...(typeof o.address === "string" && o.address.trim() ? { address: o.address.trim() } : {}),
    ...(typeof o.normalizedAddress === "string" && o.normalizedAddress.trim()
      ? { normalizedAddress: o.normalizedAddress.trim() }
      : {}),
    ...(runType ? { runType } : {}),
    ...(typeof o.sourceVersion === "string" && o.sourceVersion.trim() ? { sourceVersion: o.sourceVersion.trim() } : {}),
    ...(o.queryResultsByTarget && typeof o.queryResultsByTarget === "object"
      ? { queryResultsByTarget: o.queryResultsByTarget as BodyShape["queryResultsByTarget"] }
      : {}),
  };
}

export async function POST(req: Request) {
  const denied = await assertSocialTargetsApiAccess(req);
  if (denied) return denied;
  try {
    const body = normalizeBody(await req.json().catch(() => ({})));
    const targets = (await getMergedSocialTargets()).map(normalizeSocialTarget);
    const runType = body.runType ?? "adhoc";
    const sourceVersion = body.sourceVersion ?? "address-expansion-v1";
    const runId = runIdFromAddress(body.normalizedAddress ?? body.address, sourceVersion);
    const ids = body.targetIds?.length ? new Set(body.targetIds) : null;
    const selected = targets.filter((t) => {
      if (ids && ids.size) return ids.has(t.id);
      if (body.normalizedAddress) return (t.normalizedAddress ?? t.addressExpansion?.normalizedAddress ?? "").toLowerCase() === body.normalizedAddress.toLowerCase();
      if (body.address) return (t.addressExpansion?.sourceAddress ?? "").toLowerCase().includes(body.address.toLowerCase());
      return false;
    });
    if (!selected.length) {
      return NextResponse.json({ ok: false, error: "no targets matched input" }, { status: 400 });
    }

    const byId = new Map(targets.map((t) => [t.id, t]));
    const outcomes: Array<{
      targetId: string;
      queryCount: number;
      evidenceAdded: number;
      candidatesStaged: number;
      isLikelyMultiTenant: boolean;
      aggregatorType?: string;
      addressDensityScore: number;
      expansionPriority: "high" | "medium" | "low";
    }> = [];

    for (const target of selected) {
      const out = runAddressExpansion({
        target,
        allTargets: targets,
        sourceAddress: body.address,
        normalizedAddress: body.normalizedAddress,
        runId,
        runType,
        sourceVersion,
        queryResults: body.queryResultsByTarget?.[target.id] ?? [],
      });
      byId.set(target.id, out.target);
      outcomes.push({
        targetId: target.id,
        queryCount: out.queryPack.queries.length,
        evidenceAdded: out.evidenceAdded,
        candidatesStaged: out.candidatesStaged,
        isLikelyMultiTenant: out.classification.isLikelyMultiTenant,
        aggregatorType: out.classification.aggregatorType,
        addressDensityScore: out.classification.addressDensityScore,
        expansionPriority: out.classification.expansionPriority,
      });
    }

    const next = targets.map((t) => byId.get(t.id) ?? t);
    await saveMergedSocialTargetsAsRuntime(next);
    return NextResponse.json({
      ok: true as const,
      runId,
      runType,
      sourceVersion,
      processedTargets: selected.length,
      outcomes,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false as const, error: msg }, { status: 500 });
  }
}
