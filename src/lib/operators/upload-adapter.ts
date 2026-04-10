import crypto from "node:crypto";
import type { SourceRecord } from "./types";
import { normalizeCity, normalizeName, normalizePhone } from "@/lib/resolver/normalize";

export type RawUploadRecord = Record<string, unknown>;

export type UploadAdapterResult = {
  receivedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  doraAcceptedCount: number;
  doraRejectedCount: number;
  sourceRecords: SourceRecord[];
};

function firstString(input: RawUploadRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function normalizeUrl(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return undefined;
}

function normalizeInstagram(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/instagram\.com/i.test(trimmed)) return normalizeUrl(trimmed);
  const handle = trimmed.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/+$/, "");
  if (!handle || /[/?#]/.test(handle)) return undefined;
  return `https://www.instagram.com/${handle}/`;
}

function normalizeBooking(value?: string): string | undefined {
  return normalizeUrl(value);
}

function normalizeWebsite(value?: string): string | undefined {
  return normalizeUrl(value);
}

function compactJoin(parts: Array<string | undefined>, separator: string): string | undefined {
  const joined = parts.map((part) => (part || "").trim()).filter(Boolean).join(separator);
  return joined || undefined;
}

function isUsableBusinessName(value?: string): boolean {
  const normalized = normalizeName(value);
  if (!normalized) return false;
  if (/(unknown|null|undefined|n a|na|license|licensed|cosmetology|barber|esthetician|nail tech)/.test(normalized)) {
    return false;
  }
  return normalized.length >= 3;
}

function isDoraLikeRecord(record: RawUploadRecord): boolean {
  return Boolean(
    firstString(record, [
      "licenseNumber",
      "license_number",
      "licenseType",
      "license_type",
      "licenseStatus",
      "license_status",
      "businessName",
      "business_name",
      "firstName",
      "first_name",
      "lastName",
      "last_name",
      "profession",
    ])
  );
}

function stableSyntheticUrl(input: {
  name?: string;
  city?: string;
  address?: string;
  phone?: string;
  instagram?: string;
  booking?: string;
  website?: string;
  index: number;
}): string {
  const baseKey = [
    normalizeName(input.name),
    normalizeCity(input.city),
    normalizeName(input.address),
    normalizePhone(input.phone),
    input.instagram || "",
    input.booking || "",
    input.website || "",
  ].join("|");
  const key = baseKey || `record:${input.index}`;
  const digest = crypto.createHash("md5").update(key).digest("hex");
  return `manual-upload://record/${digest}`;
}

function inferSourceUrl(input: {
  instagram?: string;
  website?: string;
  booking?: string;
  sourceUrl?: string;
  syntheticScheme?: string;
  syntheticKey?: string;
  index: number;
  name?: string;
  city?: string;
  address?: string;
  phone?: string;
}): string {
  if (input.syntheticScheme && input.syntheticKey) {
    return `${input.syntheticScheme}${input.syntheticKey}`;
  }
  return (
    normalizeUrl(input.sourceUrl) ||
    input.instagram ||
    input.website ||
    input.booking ||
    stableSyntheticUrl({
      name: input.name,
      city: input.city,
      address: input.address,
      phone: input.phone,
      instagram: input.instagram,
      booking: input.booking,
      website: input.website,
      index: input.index,
    })
  );
}

function normalizeOperatorType(value?: string): SourceRecord["operatorType"] | undefined {
  if (value === "operator" || value === "container" || value === "child_operator") return value;
  return undefined;
}

function adaptDoraRecord(
  record: RawUploadRecord,
  index: number,
  options?: { uploadBatchId?: string }
): SourceRecord | null {
  const licenseNumber = firstString(record, ["licenseNumber", "license_number", "dora_license_number"]);
  const licenseType = firstString(record, ["licenseType", "license_type"]);
  const licenseStatus = firstString(record, ["licenseStatus", "license_status", "status"]);
  const businessName = firstString(record, ["businessName", "business_name", "entityName", "dba"]);
  const firstName = firstString(record, ["firstName", "first_name"]);
  const lastName = firstString(record, ["lastName", "last_name"]);
  const derivedPersonName = compactJoin([firstName, lastName], " ");
  const name = isUsableBusinessName(businessName) ? businessName?.trim() : derivedPersonName;
  const city = firstString(record, ["city"]);
  const state = firstString(record, ["state"]);
  const postalCode = firstString(record, ["zip", "postalCode", "postal_code"]);
  const street = firstString(record, ["address", "address1", "street", "streetAddress"]);
  const address = compactJoin([street, city, state, postalCode], ", ");
  const phone = firstString(record, ["phone", "phoneNumber", "telephone"]);
  const category = firstString(record, ["profession", "category"]);

  const hasUsableIdentity = Boolean(name && normalizeName(name));
  const hasLocationAnchor = Boolean((city && normalizeCity(city)) || (street && street.trim()));
  if (!hasUsableIdentity || !hasLocationAnchor) return null;

  const syntheticKey =
    licenseNumber?.trim() ||
    crypto
      .createHash("md5")
      .update([normalizeName(name), normalizeCity(city), normalizeName(address)].join("|"))
      .digest("hex");

  return {
    source: "manual_upload",
    evidenceType: "direct_upload",
    sourceUrl: inferSourceUrl({
      syntheticScheme: licenseNumber ? "manual-upload://dora/" : "manual-upload://dora-hash/",
      syntheticKey,
      index,
      name,
      city,
      address,
      phone,
    }),
    name,
    city,
    category,
    address,
    phone,
    operatorType: "operator",
    raw: {
      from: "manual_upload",
      uploadBatchId: options?.uploadBatchId,
      recordIndex: index,
      sourceNote: "dora_license",
      licenseNumber,
      licenseType,
      licenseStatus,
      state,
      postalCode,
      businessName,
      firstName,
      lastName,
      original: record,
    },
    extracted: {
      uploadBatchId: options?.uploadBatchId,
      recordIndex: index,
      adapter: "manual_upload",
      sourceNote: "dora_license",
      licenseNumber,
      licenseType,
      licenseStatus,
      state,
      postalCode,
      businessName,
      firstName,
      lastName,
      extractedFields: {
        name: Boolean(name),
        city: Boolean(city),
        address: Boolean(address),
        phone: Boolean(phone),
        licenseNumber: Boolean(licenseNumber),
        licenseType: Boolean(licenseType),
        licenseStatus: Boolean(licenseStatus),
      },
    },
  };
}

export function adaptUploadRecords(
  records: RawUploadRecord[],
  options?: { uploadBatchId?: string }
): UploadAdapterResult {
  const sourceRecords: SourceRecord[] = [];
  let doraAcceptedCount = 0;
  let doraRejectedCount = 0;

  records.forEach((record, index) => {
    if (isDoraLikeRecord(record)) {
      const doraRecord = adaptDoraRecord(record, index, options);
      if (!doraRecord) {
        doraRejectedCount += 1;
        return;
      }
      doraAcceptedCount += 1;
      sourceRecords.push(doraRecord);
      return;
    }

    const name = firstString(record, ["name", "displayName", "operatorName", "fullName", "techName"]);
    const city = firstString(record, ["city", "locationCity"]);
    const address = firstString(record, ["address", "streetAddress", "locationAddress"]);
    const phone = firstString(record, ["phone", "phoneNumber", "telephone", "contactPhone"]);
    const instagram = normalizeInstagram(firstString(record, ["instagram", "instagramUrl", "instagramHandle", "ig"]));
    const booking = normalizeBooking(firstString(record, ["booking", "bookingUrl", "bookingLink", "schedulerUrl"]));
    const website = normalizeWebsite(firstString(record, ["website", "websiteUrl", "site", "url"]));
    const category = firstString(record, ["category", "serviceCategory", "specialty"]);
    const parentContainerName = firstString(record, ["parentContainerName", "containerName", "salonName", "suiteName"]);
    const parentContainerId = firstString(record, ["parentContainerId", "containerId"]);
    const sourceUrl = inferSourceUrl({
      sourceUrl: firstString(record, ["sourceUrl", "profileUrl", "detailUrl"]),
      instagram,
      website,
      booking,
      index,
      name,
      city,
      address,
      phone,
    });

    const hasIdentity = Boolean(name || instagram || booking || website || phone);
    if (!hasIdentity) return;

    sourceRecords.push({
      source: "manual_upload",
      evidenceType: "direct_upload",
      sourceUrl,
      name,
      city,
      category,
      address,
      phone,
      instagram,
      booking,
      website,
      operatorType: normalizeOperatorType(firstString(record, ["operatorType", "type"])),
      parentContainerName,
      parentContainerId,
      raw: {
        from: "manual_upload",
        uploadBatchId: options?.uploadBatchId,
        recordIndex: index,
        original: record,
      },
      extracted: {
        uploadBatchId: options?.uploadBatchId,
        recordIndex: index,
        adapter: "manual_upload",
        extractedFields: {
          name: Boolean(name),
          city: Boolean(city),
          address: Boolean(address),
          phone: Boolean(phone),
          instagram: Boolean(instagram),
          booking: Boolean(booking),
          website: Boolean(website),
        },
      },
    });
  });

  return {
    receivedCount: records.length,
    acceptedCount: sourceRecords.length,
    rejectedCount: records.length - sourceRecords.length,
    doraAcceptedCount,
    doraRejectedCount,
    sourceRecords,
  };
}
