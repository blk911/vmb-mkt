import { NextRequest, NextResponse } from "next/server";
import { runIGHashtagHarvest } from "@/lib/social-targets/ig-hashtag-harvest/run-ig-hashtag-harvest";

type Body = {
  hashtag?: string;
  limit?: number;
};

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    const hashtag = String(body.hashtag ?? "").trim();
    const limit = Number(body.limit ?? 50);

    if (!hashtag) {
      return NextResponse.json(
        { ok: false, error: "Missing required field: hashtag" },
        { status: 400 }
      );
    }

    const result = await runIGHashtagHarvest(hashtag, limit);

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
