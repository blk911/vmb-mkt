import crypto from "node:crypto";
import type { OperatorRecord, SourceRecord } from "./types";
import { normalizeCity, normalizeName } from "./normalize";

function normalize(str?: string) {
  return (str || "").toLowerCase().replace(/\s+/g, "").trim();
}

function generateId(name: string, city?: string) {
  const base = `${normalize(name)}_${normalize(city)}`;
  return crypto.createHash("md5").update(base).digest("hex");
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
    let existing = master.find((m) => matchOperator(m, src));
    if (!existing) {
      const id = generateId(src.name || "unknown", src.city);
      existing = {
        id,
        name: normalizeName(src.name) || "unknown",
        city: normalizeCity(src.city),
        category: src.category,
        sources: {},
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
    existing.sources[src.source] = src;
    if (src.booking) existing.canonical.booking = src.booking;
    if (src.instagram) existing.canonical.instagram = src.instagram;
    if (src.website) existing.canonical.website = src.website;
    if (src.phone) existing.canonical.phone = src.phone;
    existing.lastUpdatedAt = new Date().toISOString();
  }
  return master;
}
