import { fetchCandidatePage } from "@/lib/operators/page-fetch";
import type { ExternalSiteCaptureRequest, ExternalSiteRawResult } from "./types";

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = match?.[1]?.replace(/\s+/g, " ").trim();
  return title || undefined;
}

function extractMetaDescription(html: string): string | undefined {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i);
  const description = match?.[1]?.replace(/\s+/g, " ").trim();
  return description || undefined;
}

export async function fetchExternalSite(request: ExternalSiteCaptureRequest): Promise<ExternalSiteRawResult> {
  const fetchedAt = new Date().toISOString();
  const fetched = await fetchCandidatePage(request.url, {
    timeoutMs: 15000,
    userAgent: "vmb-external-site-capture/1.0",
  });

  if (fetched.error || !fetched.html) {
    throw new Error(fetched.error || "fetch_failed");
  }

  return {
    url: request.url,
    finalUrl: fetched.finalUrl || request.url,
    html: fetched.html,
    title: extractTitle(fetched.html),
    metaDescription: extractMetaDescription(fetched.html),
    fetchedAt,
  };
}
