import crypto from "node:crypto";
import type { SourceRecord } from "@/lib/operators/types";
import type { EvidenceRecord, EvidenceSource, EvidenceType } from "./types";

function sourceFromSourceRecord(source: SourceRecord["source"]): EvidenceSource {
  if (source === "google") return "google";
  if (source === "instagram") return "instagram";
  if (source === "booking") return "booking";
  if (source === "directory") return "directory";
  if (source === "container") return "container";
  if (source === "website") return "website";
  return "google";
}

function hashEvidence(source: EvidenceSource, src: SourceRecord, index: number): string {
  const base = [
    source,
    src.sourceUrl || "",
    src.name || "",
    src.city || "",
    src.instagram || "",
    src.booking || "",
    src.website || "",
    String(Date.now()),
    String(index),
  ].join("|");
  return crypto.createHash("md5").update(base).digest("hex");
}

function toEvidenceType(value?: SourceRecord["evidenceType"]): EvidenceType | undefined {
  if (!value) return undefined;
  if (value === "direct_operator") return "direct_operator";
  if (value === "directory_listing") return "directory_listing";
  if (value === "suite_container") return "suite_container";
  if (value === "social_profile") return "social_profile";
  return undefined;
}

export function sourceRecordsToEvidence(records: SourceRecord[]): EvidenceRecord[] {
  const now = Date.now();
  return records.map((src, index) => {
    const source = sourceFromSourceRecord(src.source);
    return {
      id: hashEvidence(source, src, index),
      source,
      sourceUrl: src.sourceUrl || src.extractedFromUrl || src.website || src.booking || src.instagram,
      name: src.name,
      address: src.address,
      city: src.city,
      phone: src.phone,
      website: src.website,
      instagram: src.instagram,
      booking: src.booking,
      category: src.category,
      parentContainerName: src.parentContainerName,
      parentContainerAddress: src.address,
      evidenceType: toEvidenceType(src.evidenceType),
      childQuerySeeds: src.childQuerySeeds,
      raw: src.raw,
      extracted: {
        ...(src.extracted && typeof src.extracted === "object" ? (src.extracted as Record<string, unknown>) : {}),
        childQuerySeeds: src.childQuerySeeds,
      },
      createdAt: now,
    };
  });
}

