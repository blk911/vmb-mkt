import { NextResponse } from "next/server";
import { createAccessRequest } from "@/lib/access/requestAccessStore";
import { validateAccessRequest } from "@/lib/access/requestAccess";

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const validated = validateAccessRequest(body);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }

  const record = await createAccessRequest(validated.value);
  return NextResponse.json({ ok: true, request: record }, { status: 200 });
}
