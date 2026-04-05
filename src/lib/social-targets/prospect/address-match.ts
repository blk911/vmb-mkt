import type { AddressExpansionCandidate, AddressMatch, SocialEvidenceItem } from "@/types/social-target";

function normalize(value?: string): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPropertyToken(address?: string): string | undefined {
  const value = normalize(address);
  if (!value) return undefined;
  if (value.includes("sola")) return "sola";
  if (value.includes("phenix")) return "phenix";
  if (value.includes("salons by jc") || value.includes("salonsbyjc")) return "salons by jc";
  if (value.includes("mysalon")) return "mysalon";
  if (value.includes("image studios") || value.includes("imagestudios")) return "image studios";
  if (value.includes("spectra")) return "spectra";
  return undefined;
}

function cityToken(value?: string): string | undefined {
  const normalized = normalize(value);
  if (!normalized) return undefined;
  return normalized.split(" ").slice(0, 3).join(" ");
}

function streetToken(address?: string): string | undefined {
  const normalized = normalize(address);
  if (!normalized) return undefined;
  const parts = normalized.split(" ");
  if (!parts.length) return undefined;
  const number = parts[0];
  const street = parts.slice(1, 3).join(" ");
  if (!number || !street) return undefined;
  return `${number} ${street}`.trim();
}

export function computeProspectAddressMatch(input: {
  candidate: AddressExpansionCandidate;
  evidenceById: Map<string, SocialEvidenceItem>;
  sourceAddress?: string;
  city?: string;
}): AddressMatch {
  const evidence = input.candidate.evidenceIds
    .map((id) => input.evidenceById.get(id))
    .filter((x): x is SocialEvidenceItem => Boolean(x));
  const sourceAddress = normalize(input.sourceAddress);
  const candidateAddress = normalize(input.candidate.sourceAddress ?? evidence.find((item) => item.addressLink)?.addressLink);
  const textBlob = [
    input.candidate.operatorName,
    input.candidate.url,
    input.candidate.bookingUrl,
    ...evidence.map((item) => `${item.title ?? ""} ${item.snippet ?? ""} ${item.url ?? ""}`),
  ]
    .join(" ")
    .toLowerCase();
  const street = streetToken(input.sourceAddress);
  const hasExplicitAddressSignal =
    evidence.some((item) => item.matchSignals.geoMatch) ||
    (Boolean(street) && textBlob.includes(street as string));
  const exactAddressMatch = Boolean(sourceAddress && candidateAddress && sourceAddress === candidateAddress && hasExplicitAddressSignal);

  const property = extractPropertyToken(input.sourceAddress);
  const propertyMatch = Boolean(property && textBlob.includes(property));

  const city = cityToken(input.city);
  const cityMatch = Boolean(
    (sourceAddress && candidateAddress && sourceAddress === candidateAddress) ||
    evidence.some((item) => item.matchSignals.geoMatch) ||
      (city && textBlob.includes(city))
  );

  let score = 0;
  if (exactAddressMatch) score += 30;
  if (propertyMatch) score += 20;
  if (cityMatch) score += 10;
  if (!exactAddressMatch && !propertyMatch && !cityMatch) score -= 10;

  return {
    exactAddressMatch,
    propertyMatch,
    cityMatch,
    score,
  };
}
