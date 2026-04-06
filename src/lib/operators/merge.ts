import crypto from "node:crypto";
import type { OperatorRecord, SourceRecord } from "./types";
import { isHandleLikeName, normalizeCity, normalizeName } from "./normalize";

function normalize(str?: string) {
  return (str || "").toLowerCase().replace(/\s+/g, "").trim();
}

function generateId(name: string, city?: string) {
  const base = `${normalize(name)}_${normalize(city)}`;
  return crypto.createHash("md5").update(base).digest("hex");
}

function sourceStrength(src?: SourceRecord): number {
  if (!src) return 0;
  let score = 0;
  if (src.extractedFromUrl) score += 4;
  if (src.evidenceType && src.evidenceType !== "unknown") score += 3;
  if (src.address) score += 2;
  if (src.phone) score += 2;
  if (src.website) score += 2;
  if (src.instagram) score += 2;
  if (src.booking) score += 2;
  if (src.parentContainerName) score += 1;
  return score;
}

function preferSourceRecord(current: SourceRecord | undefined, incoming: SourceRecord): SourceRecord {
  if (!current) return incoming;
  return sourceStrength(incoming) >= sourceStrength(current) ? incoming : current;
}

function shouldPreferName(currentName: string | undefined, incomingName: string | undefined, incoming: SourceRecord): boolean {
  if (!incomingName) return false;
  if (!currentName || currentName.toLowerCase() === "unknown") return true;
  if (sourceStrength(incoming) > 0 && isHandleLikeName(currentName) && !isHandleLikeName(incomingName)) return true;
  return false;
}

function sourceFingerprint(src: SourceRecord): string {
  return [
    src.source,
    normalize(src.sourceUrl || src.extractedFromUrl || src.booking || src.instagram || src.website),
    normalize(src.name),
    normalize(src.city),
    normalize(src.parentContainerName),
    src.evidenceType || "",
  ].join("|");
}

function matchOperator(a: OperatorRecord, b: SourceRecord) {
  if (a.canonical.instagram && b.instagram) {
    return normalize(a.canonical.instagram) === normalize(b.instagram);
  }
  if (a.canonical.website && b.website) {
    return normalize(a.canonical.website) === normalize(b.website);
  }
  return normalize(a.name) === normalize(b.name) && normalize(a.city) === normalize(b.city);
}

export function mergeSources(sources: SourceRecord[]): OperatorRecord[] {
  const master: OperatorRecord[] = [];
  for (const src of sources) {
    const normalizedName = normalizeName(src.name) || normalizeName(src.parentContainerName);
    const normalizedCity = normalizeCity(src.city);
    let existing = master.find((m) => matchOperator(m, src));
    if (!existing) {
      const id = generateId(normalizedName || src.name || "unknown", normalizedCity || src.city);
      existing = {
        id,
        name: normalizedName || "unknown",
        city: normalizedCity,
        category: src.category,
        sources: {},
        evidence: [],
        canonical: {},
        validation: {
          instagramStatus: "missing",
          bookingStatus: "missing",
          websiteStatus: "missing",
        },
        status: "shelved",
        confidenceScore: 0,
        lastUpdatedAt: new Date().toISOString(),
      };
      master.push(existing);
    }

    existing.sources[src.source] = preferSourceRecord(existing.sources[src.source], src);

    existing.evidence ||= [];
    const key = sourceFingerprint(src);
    if (!existing.evidence.some((e) => sourceFingerprint(e) === key)) {
      existing.evidence.push(src);
    }

    if (shouldPreferName(existing.name, normalizedName, src)) {
      existing.name = normalizedName || existing.name;
    }
    if ((!existing.city || sourceStrength(src) > 0) && normalizedCity) {
      existing.city = normalizedCity;
    }
    if (!existing.category && src.category) existing.category = src.category;

    if (src.booking && (!existing.canonical.booking || sourceStrength(src) > 0)) {
      existing.canonical.booking = src.booking;
    }
    if (src.instagram && (!existing.canonical.instagram || sourceStrength(src) > 0)) {
      existing.canonical.instagram = src.instagram;
    }
    if (src.website && (!existing.canonical.website || sourceStrength(src) > 0)) {
      existing.canonical.website = src.website;
    }
    if (src.phone && (!existing.canonical.phone || sourceStrength(src) > 0)) {
      existing.canonical.phone = src.phone;
    }
    existing.lastUpdatedAt = new Date().toISOString();
  }
  return master;
}
