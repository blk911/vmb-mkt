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
import { deepExtractFromSolaChildPage, isSolaChildDetailUrl } from "../containers/sola-deep-extract";

const CHILD_STRENGTHENING_SUMMARY_PATH = path.join(process.cwd(), "runtime-data/child_strengthening_summary.json");
const SOLA_CHILD_STRENGTHENING_SUMMARY_PATH = path.join(process.cwd(), "runtime-data/sola_child_strengthening_summary.json");
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

function isSolaChild(op: ReturnType<typeof loadResolverRegistry>[number]): boolean {
  if (!op.parentContainerId) return false;
  const parentHint = [op.parentContainerName || "", ...op.sources.map((row) => row.parentContainerName || "")]
    .join(" ")
    .toLowerCase();
  if (parentHint.includes("sola")) return true;
  return op.sources.some((row) => isSolaChildDetailUrl(row.sourceUrl || ""));
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
  const weakChildren = registry.filter(isWeakChild);
  const solaWeakChildren = weakChildren.filter(isSolaChild);
  const nonSolaWeakChildren = weakChildren.filter((row) => !isSolaChild(row));
  const candidates = [...solaWeakChildren, ...nonSolaWeakChildren].slice(0, childLimit);

  const enrichedSources: SourceRecord[] = [];
  let urlsScanned = 0;
  let solaChildrenAttempted = 0;
  const solaAttemptedIds = new Set<string>();

  for (const child of candidates) {
    const childIsSola = isSolaChild(child);
    if (childIsSola && !solaAttemptedIds.has(child.id)) {
      solaAttemptedIds.add(child.id);
      solaChildrenAttempted += 1;
    }
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
      const deepSola = isSolaChildDetailUrl(fetched.finalUrl || detailUrl)
        ? deepExtractFromSolaChildPage({ url: fetched.finalUrl || detailUrl, html: fetched.html })
        : undefined;
      const strengthened: SourceRecord = {
        source: deepSola?.booking
          ? "booking"
          : deepSola?.instagram
            ? "instagram"
            : deepSola?.website
              ? "website"
              : inferSourceKind(detailUrl),
        operatorType: "child_operator",
        sourceUrl: detailUrl,
        extractedFromUrl: fetched.finalUrl || detailUrl,
        name: deepSola?.name || extracted.name || child.canonicalName,
        city: extracted.city || child.canonicalCity,
        address: extracted.address || child.canonicalAddress,
        phone: deepSola?.phone || extracted.phone || child.canonicalPhone,
        website: deepSola?.website || extracted.website || child.canonicalWebsite,
        booking: deepSola?.booking || extracted.booking || child.canonicalBooking,
        instagram: deepSola?.instagram || extracted.instagram || child.canonicalInstagram,
        category: deepSola?.category || extracted.category || child.category,
        parentContainerName:
          deepSola?.parentContainerName ||
          extracted.parentContainerName ||
          child.sources.find((row) => row.parentContainerName)?.parentContainerName,
        parentContainerId: child.parentContainerId,
        evidenceType: extracted.evidenceType,
        raw: {
          from: "child_strengthening",
          childOperatorId: child.id,
          parentContainerId: child.parentContainerId,
          deepExtractor: deepSola?.extractionSignals?.length ? "sola" : undefined,
        },
        extracted: {
          parserUsed: deepSola?.extractionSignals?.length ? "sola-deep" : extracted.parserUsed,
          internalDetailLinks: deepSola?.internalDetailLinks || extracted.internalDetailLinks,
          extractionSignals: deepSola?.extractionSignals,
          email: deepSola?.email || extracted.email,
          operatorType: "child_operator",
          parentContainerId: child.parentContainerId,
        },
      };
      enrichedSources.push(strengthened);
    }
  }

  const evidenceRows = sourceRecordsToEvidence(enrichedSources);
  appendEvidence(evidenceRows);
  const preRegistry = registry;
  const operators = runResolver();
  const auditPath = writeChildOperatorAudit(operators);

  const preSola = preRegistry.filter((row) => isSolaChild(row));
  const postSola = operators.filter((row) => isSolaChild(row));
  const preMap = new Map(preSola.map((row) => [row.id, row]));
  let upgradedWithWebsite = 0;
  let upgradedWithInstagram = 0;
  let upgradedWithBooking = 0;
  for (const row of postSola) {
    const prior = preMap.get(row.id);
    if (!prior) continue;
    if (!prior.canonicalWebsite && row.canonicalWebsite) upgradedWithWebsite += 1;
    if (!prior.canonicalInstagram && row.canonicalInstagram) upgradedWithInstagram += 1;
    if (!prior.canonicalBooking && row.canonicalBooking) upgradedWithBooking += 1;
  }
  const preProvisionalCount = preSola.filter((row) => !row.canonicalName || !row.canonicalName.includes(" ")).length;
  const postProvisionalCount = postSola.filter((row) => !row.canonicalName || !row.canonicalName.includes(" ")).length;
  const preResolvedCount = preSola.length - preProvisionalCount;
  const postResolvedCount = postSola.length - postProvisionalCount;

  writeSummary({
    generatedAt: new Date().toISOString(),
    attemptedChildren: candidates.length,
    urlsScanned,
    evidenceAdded: evidenceRows.length,
    auditPath,
  });

  fs.mkdirSync(path.dirname(SOLA_CHILD_STRENGTHENING_SUMMARY_PATH), { recursive: true });
  fs.writeFileSync(
    SOLA_CHILD_STRENGTHENING_SUMMARY_PATH,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        solaChildrenAttempted,
        solaChildrenUpgradedWithWebsite: upgradedWithWebsite,
        solaChildrenUpgradedWithInstagram: upgradedWithInstagram,
        solaChildrenUpgradedWithBooking: upgradedWithBooking,
        preProvisionalCount,
        postProvisionalCount,
        preResolvedCount,
        postResolvedCount,
      },
      null,
      2
    )}\n`
  );

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

