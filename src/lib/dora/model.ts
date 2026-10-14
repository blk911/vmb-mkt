import type { DoraCheck, DoraCrossReference, DoraOfficialRow, DoraSubject } from "./types";

export const DORA_DATASET_URL = "https://data.colorado.gov/resource/7s5z-vewr.json";
export const DORA_DATASET_PAGE = "https://data.colorado.gov/Business/Professional-and-Occupational-Licenses/7s5z-vewr";
export const DORA_MAX_ROWS = 20;
export const DORA_LICENSE_TYPES: Record<string, string> = {
  BAR: "Barber", COS: "Cosmetologist", COZ: "Esthetician", HST: "Hairstylist", MAN: "Nail Technician",
  MSBAR: "Military Spouse Barber", MSCOS: "Military Spouse Cosmetologist", MSCOZ: "Military Spouse Esthetician",
  MSHST: "Military Spouse Hairstylist", MSMAN: "Military Spouse Nail Technician", REG: "Shop Registration",
};
const str = (value: unknown) => typeof value === "string" ? value.trim() : "";
export const normalizeDoraName = (value?: string) => str(value).normalize("NFKC").replace(/\s+/g, " ").toUpperCase();
export const normalizeDoraNumber = (value?: string) => /^\d{1,12}$/.test(str(value)) ? str(value).replace(/^0+(?=\d)/, "") : "";
const unique = (values: string[]) => [...new Set(values)];
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const allowedPrefixes = (subject: DoraSubject) => Object.keys(DORA_LICENSE_TYPES).filter((prefix) => subject.scope === "shop" ? prefix === "REG" : prefix !== "REG");
const validClaims = (subject: DoraSubject) => (subject.licenseClaims || []).filter((claim) => claim.sourceRef && allowedPrefixes(subject).includes(claim.prefix.toUpperCase()) && normalizeDoraNumber(claim.number));

export function emptyDoraCheck(reason = "Not checked against the official DORA dataset."): DoraCheck {
  return { status: "unknown", outcome: "not_checked", matches: [], reasons: [reason], conflicts: [], sourceUrl: DORA_DATASET_PAGE };
}
export function emptyDoraCrossReference(): DoraCrossReference {
  return { schemaVersion: 1, personLicense: emptyDoraCheck(), shopRegistration: emptyDoraCheck() };
}
function nameParts(subject: DoraSubject) {
  const parts = normalizeDoraName(subject.name).split(" ").filter(Boolean);
  return { first: normalizeDoraName(subject.firstName) || parts[0] || "", last: normalizeDoraName(subject.lastName) || parts.at(-1) || "", count: parts.length };
}
/** Exact-name or exact-prefix-and-number lookups only; never a city-wide or fuzzy crawl. */
export function buildDoraQuery(subject: DoraSubject): string | null {
  const name = normalizeDoraName(subject.name);
  if (!name || name.length > 160 || /[@/:\u0000-\u001f]/.test(name)) return null;
  const claims = validClaims(subject);
  let identity: string;
  if (claims.length === 1) identity = `(licensetype=${quote(claims[0].prefix.toUpperCase())} AND licensenumber=${quote(normalizeDoraNumber(claims[0].number))})`;
  else if (subject.scope === "shop") identity = `upper(entityname)=${quote(name)}`;
  else {
    const parts = nameParts(subject);
    if (parts.count < 2 || parts.first.length < 2 || parts.last.length < 2) return null;
    identity = `(upper(firstname)=${quote(parts.first)} AND upper(lastname)=${quote(parts.last)})`;
  }
  const url = new URL(DORA_DATASET_URL);
  url.searchParams.set("$select", "firstname,middlename,lastname,suffix,entityname,licensetype,licensenumber,licensestatusdescription,city,state,mailzipcode,licenseexpirationdate,linktoverifylicense");
  url.searchParams.set("$where", `licensetype in (${allowedPrefixes(subject).map(quote).join(",")}) AND ${identity}`);
  url.searchParams.set("$limit", String(DORA_MAX_ROWS + 1));
  url.searchParams.set("$order", "licensetype,licensenumber");
  return url.href;
}
export function officialDoraSourceUrl(value: unknown): string {
  try {
    const url = new URL(str(value));
    if (url.protocol === "https:" && !url.username && !url.password && !url.port &&
      ["www.colorado.gov", "colorado.gov", "apps.colorado.gov", "apps2.colorado.gov", "dpo.colorado.gov", "data.colorado.gov"].includes(url.hostname)) return url.href;
  } catch { /* Untrusted source URLs never become clickable non-official links. */ }
  return DORA_DATASET_PAGE;
}
function rowName(row: DoraOfficialRow, subject: DoraSubject) {
  return subject.scope === "shop" ? str(row.entityname) : [row.firstname, row.middlename, row.lastname, row.suffix].map(str).filter(Boolean).join(" ");
}
export function matchDoraRecords(subject: DoraSubject, rows: DoraOfficialRow[], context: { attemptedAt?: string; checkedAt: string; datasetUpdatedAt?: string; truncated?: boolean }): DoraCheck {
  const check: DoraCheck = { ...emptyDoraCheck(), ...context, outcome: "no_match", reasons: [] };
  const groups = new Map<string, DoraOfficialRow[]>();
  let malformed = false;
  for (const row of rows.slice(0, DORA_MAX_ROWS)) {
    if (!row || typeof row !== "object") { malformed = true; continue; }
    const prefix = str(row.licensetype).toUpperCase(), number = normalizeDoraNumber(row.licensenumber);
    if (!prefix || !number) { malformed = true; continue; }
    if (!allowedPrefixes(subject).includes(prefix)) { malformed = true; continue; }
    const key = `${prefix}:${number}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  const claims = validClaims(subject);
  for (const [key, group] of groups) {
    const row = group[0], [prefix, number] = key.split(":"), name = rowName(row, subject);
    const basis: string[] = [], conflicts: string[] = [];
    const exactName = normalizeDoraName(name) === normalizeDoraName(subject.name);
    if (exactName) basis.push("Exact full name"); else conflicts.push("Full name differs; identity needs review");
    for (const [label, input, found] of [["city", subject.city, row.city], ["state", subject.state, row.state], ["postal code", subject.postalCode?.slice(0, 5), row.mailzipcode?.slice(0, 5)]] as const) {
      if (!str(input) || !str(found)) continue;
      if (normalizeDoraName(input) === normalizeDoraName(found)) basis.push(`Same holder-reported mailing ${label}`);
      else conflicts.push(`Different holder-reported mailing ${label}`);
    }
    const matchingClaim = claims.find((claim) => claim.prefix.toUpperCase() === prefix && normalizeDoraNumber(claim.number) === number);
    if (matchingClaim) basis.push(`Exact independently reported license prefix and number (${matchingClaim.sourceRef})`);
    if (claims.length && !matchingClaim) conflicts.push("Reported license number differs");
    if (claims.length > 1) conflicts.push("Multiple reported license claims require review");
    for (const field of ["firstname", "middlename", "lastname", "suffix", "entityname", "licensestatusdescription", "city", "state", "mailzipcode", "licenseexpirationdate"] as const) {
      if (unique(group.map((entry) => normalizeDoraName(entry[field]))).length > 1) conflicts.push(`Conflicting source rows: ${field}`);
    }
    const statusText = str(row.licensestatusdescription);
    const expiration = str(row.licenseexpirationdate);
    if (expiration) {
      const date = Date.parse(expiration), checked = Date.parse(context.checkedAt);
      if (!Number.isFinite(date)) conflicts.push("Invalid official expiration date");
      else if (normalizeDoraName(statusText) === "ACTIVE" && date + 24 * 60 * 60_000 <= checked) conflicts.push("Official Active status conflicts with a past expiration date; verify with DORA");
      else if (normalizeDoraName(statusText) === "EXPIRED" && date > checked) conflicts.push("Official Expired status conflicts with a future expiration date; verify with DORA");
    }
    const identity = exactName && Boolean(matchingClaim) && conflicts.length === 0 ? "corroborated" as const : "review" as const;
    check.matches.push({ name, licenseType: DORA_LICENSE_TYPES[prefix], licensePrefix: prefix, licenseNumber: `${prefix}.${str(row.licensenumber)}`, statusText,
      city: str(row.city), state: str(row.state), postalCode: str(row.mailzipcode), sourceUrl: officialDoraSourceUrl(row.linktoverifylicense?.url), datasetUrl: DORA_DATASET_PAGE,
      expirationDate: str(row.licenseexpirationdate) || undefined, identity, basis, conflicts, sourceRows: group.length });
  }
  check.truncated = Boolean(context.truncated || rows.length > DORA_MAX_ROWS);
  check.conflicts = unique(check.matches.flatMap((match) => match.conflicts));
  if (malformed) {
    check.status = "review"; check.outcome = "error";
    check.conflicts.push("Official response includes malformed or out-of-scope records; no complete conclusion is possible.");
    return check;
  }
  check.reasons.push("This official dataset is refreshed nightly for research; it is not real-time license verification.");
  check.reasons.push("DORA mailing locations are holder-reported; license records do not establish employment, shop ownership or independence.");
  if (!check.matches.length) {
    check.reasons.push("No matching record returned in this bounded lookup. This does not mean unlicensed.");
    if (check.truncated) { check.outcome = "ambiguous"; check.status = "review"; check.reasons.push("Lookup truncated; no negative conclusion is possible."); }
    return check;
  }
  if (check.matches.length !== 1 || check.truncated) {
    check.status = "review"; check.outcome = "ambiguous";
    check.reasons.push(check.truncated ? "Source response exceeded the bounded result limit." : "Multiple license records need review.");
    return check;
  }
  const match = check.matches[0];
  check.status = "review"; check.outcome = match.identity === "corroborated" ? "matched" : "insufficient_identity";
  if (match.identity !== "corroborated") check.reasons.push("Name and mailing location alone cannot confirm identity. Compare an independently reported license number.");
  else if (normalizeDoraName(match.statusText) === "ACTIVE") check.status = "active";
  else if (normalizeDoraName(match.statusText) === "EXPIRED") check.status = "expired";
  else check.reasons.push("Official status is missing or requires review; no active/inactive inference was made.");
  return check;
}
