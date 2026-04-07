import fs from "node:fs";
import path from "node:path";
import { appendEvidence } from "../evidence/store";
import { sourceRecordsToEvidence } from "../evidence/ingest";
import { extractFromPage } from "../operators/page-extract";
import { fetchCandidatePage } from "../operators/page-fetch";
import type { SourceRecord } from "../operators/types";
import { loadResolverRegistry } from "./registry-store";
import { runResolver } from "./run-resolver";
import { writeChildOperatorAudit } from "./child-audit";

const CHILD_STRENGTHENING_SUMMARY_PATH = path.join(process.cwd(), "runtime-data/child_strengthening_summary.json");
const DETAIL_HINT = /(profile|provider|professional|staff|artist|detail|book|booking|service|team|tenant|member|technician)/i;

type ChildStrengtheningResult = {
  attemptedChildren: number;
  urlsScanned: number;
  evidenceAdded: number;
  auditPath: string;
};

function parseDetailLinksFromExtracted(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  if (!("internalDetailLinks" in (value as Record<string, unknown>))) return [];
  const raw = (value as Record<string, unknown>).internalDetailLinks;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.startsWith("http"));
}

function collectKnownDetailUrls(sourceRows: Array<{ sourceUrl?: string; extracted?: unknown }>): string[] {
  const urls: string[] = [];
  for (const row of sourceRows) {
    if (row.sourceUrl && DETAIL_HINT.test(row.sourceUrl)) urls.push(row.sourceUrl);
    urls.push(...parseDetailLinksFromExtracted(row.extracted));
  }
  return [...new Set(urls)].slice(0, 8);
}

function isWeakChild(op: ReturnType<typeof loadResolverRegistry>[number]): boolean {
  if (op.isContainer || !op.parentContainerId) return false;
  return !op.canonicalBooking && !op.canonicalInstagram && !op.canonicalWebsite;
}

function inferSourceKind(url: string): SourceRecord["source"] {
  const lower = url.toLowerCase();
  if (lower.includes("instagram.com")) return "instagram";
  if (/(booksy|vagaro|fresha|styleseat|glossgenius|square\.site|booking)/.test(lower)) return "booking";
  return "website";
}

function writeSummary(data: unknown): void {
  fs.mkdirSync(path.dirname(CHILD_STRENGTHENING_SUMMARY_PATH), { recursive: true });
  fs.writeFileSync(CHILD_STRENGTHENING_SUMMARY_PATH, `${JSON.stringify(data, null, 2)}\n`);
}

export async function runChildStrengtheningPass(opts?: { childLimit?: number }): Promise<ChildStrengtheningResult> {
  const childLimit = Math.max(1, Math.min(200, opts?.childLimit ?? 80));
  const registry = loadResolverRegistry();
  const candidates = registry.filter(isWeakChild).slice(0, childLimit);

  const enrichedSources: SourceRecord[] = [];
  let urlsScanned = 0;

  for (const child of candidates) {
    const detailUrls = collectKnownDetailUrls(child.sources);
    if (!detailUrls.length) continue;
    for (const detailUrl of detailUrls) {
      const fetched = await fetchCandidatePage(detailUrl, { timeoutMs: 12000 });
      if (!fetched.statusCode || !fetched.html) continue;
      urlsScanned += 1;
      const extracted = extractFromPage(fetched.finalUrl || detailUrl, fetched.html, {
        source: inferSourceKind(detailUrl),
        sourceUrl: detailUrl,
        name: child.canonicalName,
        city: child.canonicalCity,
        address: child.canonicalAddress,
        phone: child.canonicalPhone,
        website: child.canonicalWebsite,
        booking: child.canonicalBooking,
        instagram: child.canonicalInstagram,
        category: child.category,
        parentContainerName: child.sources.find((row) => row.parentContainerName)?.parentContainerName,
        evidenceType: "direct_operator",
      });
      const strengthened: SourceRecord = {
        source: inferSourceKind(detailUrl),
        sourceUrl: detailUrl,
        extractedFromUrl: fetched.finalUrl || detailUrl,
        name: extracted.name || child.canonicalName,
        city: extracted.city || child.canonicalCity,
        address: extracted.address || child.canonicalAddress,
        phone: extracted.phone || child.canonicalPhone,
        website: extracted.website || child.canonicalWebsite,
        booking: extracted.booking || child.canonicalBooking,
        instagram: extracted.instagram || child.canonicalInstagram,
        category: extracted.category || child.category,
        parentContainerName: extracted.parentContainerName || child.sources.find((row) => row.parentContainerName)?.parentContainerName,
        evidenceType: extracted.evidenceType,
        raw: {
          from: "child_strengthening",
          childOperatorId: child.id,
          parentContainerId: child.parentContainerId,
        },
        extracted: {
          parserUsed: extracted.parserUsed,
          internalDetailLinks: extracted.internalDetailLinks,
        },
      };
      enrichedSources.push(strengthened);
    }
  }

  const evidenceRows = sourceRecordsToEvidence(enrichedSources);
  appendEvidence(evidenceRows);
  const operators = runResolver();
  const auditPath = writeChildOperatorAudit(operators);

  writeSummary({
    generatedAt: new Date().toISOString(),
    attemptedChildren: candidates.length,
    urlsScanned,
    evidenceAdded: evidenceRows.length,
    auditPath,
  });

  return {
    attemptedChildren: candidates.length,
    urlsScanned,
    evidenceAdded: evidenceRows.length,
    auditPath,
  };
}

if (require.main === module) {
  runChildStrengtheningPass()
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    })
    .catch((error: unknown) => {
      process.stderr.write(`${String(error)}\n`);
      process.exitCode = 1;
    });
}

