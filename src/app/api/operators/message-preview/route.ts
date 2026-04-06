import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { buildOutreachMessage } from "@/lib/operators/outreach-message";
import { getOutreachEligibility } from "@/lib/operators/outreach-eligibility";
import type { OperatorRecord } from "@/lib/operators/types";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), "runtime-data/operator_master.v1.json");

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "operator_master.v1.json not found" }, { status: 404 });
  }

  const operators = JSON.parse(fs.readFileSync(filePath, "utf-8")) as OperatorRecord[];
  const op = operators.find((item) => item.id === id);

  if (!op) {
    return NextResponse.json({ error: "Operator not found" }, { status: 404 });
  }

  const outreach = getOutreachEligibility(op);

  return NextResponse.json({
    operator: {
      id: op.id,
      name: op.name,
      city: op.city,
      status: op.status,
      confidenceScore: op.confidenceScore,
      canonical: op.canonical,
    },
    outreach,
    message: outreach.eligible ? buildOutreachMessage(op) : null,
  });
}
