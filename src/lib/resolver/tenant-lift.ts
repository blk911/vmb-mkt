import crypto from "node:crypto";
import { extractFromPage } from "@/lib/operators/page-extract";
import { fetchCandidatePage } from "@/lib/operators/page-fetch";
import type { EvidenceRecord } from "@/lib/evidence/types";
import type { ResolverOperator } from "./types";

export type TenantLiftResult = {
  tenantEvidence: EvidenceRecord[];
  followOnUrls: string[];
  scannedUrls: string[];
  yieldedDirectDetailPages: boolean;
};

const TENANT_HINT = /(profile|provider|professional|staff|artist|tenant|member|technician|suite)/i;
const BLOCK_HINT = /(login|signup|register|privacy|terms|help|contact|about|careers)/i;

function tenantSourceUrls(operator: ResolverOperator): string[] {
  const urls = operator.sources
    .filter((row) => row.source === "container" || row.evidenceType === "suite_container" || row.parentContainerName)
    .map((row) => row.sourceUrl)
    .filter((x): x is string => Boolean(x && x.startsWith("http")));
  return [...new Set(urls)].slice(0, 3);
}

function evidenceId(seed: string): string {
  return crypto.createHash("md5").update(seed).digest("hex");
}

export async function liftTenantsFromContainer(operator: ResolverOperator): Promise<TenantLiftResult> {
  const tenantEvidence: EvidenceRecord[] = [];
  const followOnUrls: string[] = [];
  const scannedUrls: string[] = [];
  let yieldedDirectDetailPages = false;
  const urls = tenantSourceUrls(operator);

  for (const sourceUrl of urls) {
    const fetched = await fetchCandidatePage(sourceUrl);
    if (!fetched.statusCode || !fetched.html) continue;
    scannedUrls.push(sourceUrl);

    const extracted = extractFromPage(fetched.finalUrl || sourceUrl, fetched.html, {
      source: "container",
      sourceUrl,
      name: operator.canonicalName,
      city: operator.canonicalCity,
      address: operator.canonicalAddress,
      phone: operator.canonicalPhone,
      website: operator.canonicalWebsite,
      booking: operator.canonicalBooking,
      instagram: operator.canonicalInstagram,
      evidenceType: "suite_container",
    });

    const parentContainerName =
      extracted.parentContainerName || operator.canonicalName || operator.sources.find((row) => row.parentContainerName)?.parentContainerName;
    const detailLinks = (extracted.internalDetailLinks || [])
      .filter((url) => TENANT_HINT.test(url))
      .filter((url) => !BLOCK_HINT.test(url))
      .slice(0, 12);
    if (detailLinks.length) yieldedDirectDetailPages = true;
    for (const detailUrl of detailLinks) {
      followOnUrls.push(detailUrl);
      tenantEvidence.push({
        id: evidenceId(
          [
            "tenant-lift",
            operator.id,
            parentContainerName || "",
            detailUrl,
            operator.canonicalCity || "",
          ].join("|")
        ),
        source: "container",
        sourceUrl: detailUrl,
        name: undefined,
        city: operator.canonicalCity,
        address: undefined,
        phone: undefined,
        website: undefined,
        instagram: undefined,
        booking: undefined,
        category: operator.category,
        parentContainerName,
        parentContainerAddress: operator.canonicalAddress,
        evidenceType: "direct_operator",
        createdAt: Date.now(),
        raw: {
          from: "promotion",
          promotionMethod: "tenant_lift",
          operatorId: operator.id,
          parentSourceUrl: sourceUrl,
        },
        extracted: {
          tenantLift: true,
          fromContainer: sourceUrl,
        },
      });
    }
  }

  return {
    tenantEvidence: tenantEvidence.slice(0, 20),
    followOnUrls: [...new Set(followOnUrls)].slice(0, 20),
    scannedUrls,
    yieldedDirectDetailPages,
  };
}

