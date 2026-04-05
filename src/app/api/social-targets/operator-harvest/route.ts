import { NextResponse } from "next/server";
import { runOperatorHarvest } from "@/lib/social-targets/operator-harvest/run-operator-harvest";
import type { OperatorHarvestRunInput } from "@/lib/social-targets/operator-harvest/types";
import { assertSocialTargetsApiAccess } from "@/lib/social-targets/social-targets-api-access";

function normalizeBody(raw: unknown): OperatorHarvestRunInput {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const category = typeof o.category === "string" && o.category.trim() ? o.category.trim() : undefined;
  const geoLabels = Array.isArray(o.geoLabels)
    ? o.geoLabels.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
    : undefined;
  const maxQueries = typeof o.maxQueries === "number" && Number.isFinite(o.maxQueries) ? Math.round(o.maxQueries) : undefined;
  const useLiveIntake = typeof o.useLiveIntake === "boolean" ? o.useLiveIntake : undefined;
  const resultsPerQuery =
    typeof o.resultsPerQuery === "number" && Number.isFinite(o.resultsPerQuery) ? Math.round(o.resultsPerQuery) : undefined;
  const requestDelayMs =
    typeof o.requestDelayMs === "number" && Number.isFinite(o.requestDelayMs) ? Math.round(o.requestDelayMs) : undefined;
  const queryResultsByQuery =
    o.queryResultsByQuery && typeof o.queryResultsByQuery === "object"
      ? (o.queryResultsByQuery as OperatorHarvestRunInput["queryResultsByQuery"])
      : undefined;
  return {
    ...(category ? { category } : {}),
    ...(geoLabels ? { geoLabels } : {}),
    ...(typeof maxQueries === "number" ? { maxQueries } : {}),
    ...(typeof useLiveIntake === "boolean" ? { useLiveIntake } : {}),
    ...(typeof resultsPerQuery === "number" ? { resultsPerQuery } : {}),
    ...(typeof requestDelayMs === "number" ? { requestDelayMs } : {}),
    ...(queryResultsByQuery ? { queryResultsByQuery } : {}),
  };
}

export async function POST(req: Request) {
  const denied = await assertSocialTargetsApiAccess(req);
  if (denied) return denied;
  try {
    const body = normalizeBody(await req.json().catch(() => ({})));
    const output = await runOperatorHarvest(body);
    return NextResponse.json({
      ok: true as const,
      summary: output.summary,
      topProspects: output.prospects.slice(0, 15),
      artifactPaths: output.artifactPaths,
      queryCount: output.queryPack.queries.length,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
