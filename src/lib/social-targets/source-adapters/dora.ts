import type { SourceCandidateInput } from "@/lib/social-targets/source-adapters/types";
import {
  asRecord,
  compactEvidence,
  createBaseCandidate,
  normalizePhone,
  normalizeUrl,
  pickString,
  pickStringArray,
} from "@/lib/social-targets/source-adapters/shared";

/**
 * DORA is tier1 legitimacy/anchor evidence, but can differ from consumer-facing brand naming.
 */
export function adaptDoraRecord(raw: unknown): SourceCandidateInput[] {
  const r = asRecord(raw);
  const personName = pickString(r, ["fullName", "dora_full_name", "name"]);
  const businessName = pickString(r, ["entityName", "businessName", "shopName", "dba"]);
  const address = pickString(r, ["address", "address_key", "addressKey", "street"]);
  const city = pickString(r, ["city"]);
  const state = pickString(r, ["state"]);
  const postalCode = pickString(r, ["zip", "postalCode", "postal_code"]);
  const category = pickString(r, ["operational_category", "category", "profession", "dora_raw_profession"]);
  const rawId = pickString(r, ["rowId", "dora_row_id", "dora_license_number", "license_row_id", "id"]);
  const licenseStatus = pickString(r, ["licenseStatus", "dora_license_status", "status"]);

  const evidence = compactEvidence([
    personName ? `DORA operator/person record: ${personName}` : undefined,
    businessName ? `DORA business/entity record: ${businessName}` : undefined,
    licenseStatus ? `DORA license status: ${licenseStatus}` : undefined,
    city && state ? `DORA territory: ${city}, ${state}` : undefined,
    "DORA indicates legitimacy but may not match public-facing brand name directly.",
  ]);

  return [
    {
      ...createBaseCandidate({
        sourceType: "dora",
        sourceTrustTier: "tier1",
        sourceLabel: "DORA",
        rawSourceId: rawId,
      }),
      businessName,
      personName,
      alternateNames: pickStringArray(r, ["raw_names", "raw_entity_names", "alternateNames"]),
      phone: normalizePhone(pickString(r, ["phone"])),
      website: normalizeUrl(pickString(r, ["website"])),
      address,
      city,
      state,
      postalCode,
      category,
      anchorHint: true,
      territoryHint: Boolean(city || state || postalCode),
      rawSourceType: "dora_license_or_shop",
      evidence,
      notes: ["Do not assume DORA name is the exact consumer-facing brand without corroboration."],
    },
  ];
}

