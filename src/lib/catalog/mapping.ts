import type { CatalogFactClaim, CatalogFieldMapping, CatalogMappingEvidence, CatalogRecord, CatalogSourceRef, CatalogVertical } from "./types";

export const CATALOG_VERTICALS: readonly CatalogVertical[] = ["Nail", "Hair", "Skin", "Lash", "Brow", "Makeup", "Massage", "Waxing", "Barber", "Other"];
const str = (value: unknown) => typeof value === "string" ? value.trim() : "";
const obj = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const norm = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
const known = (value: string) => value && !/^(unknown|unspecified|not known|n\/?a|null|none)$/i.test(value);

/** Controlled vocabulary over explicit category/service fields only, never names or raw page text. */
export function catalogVerticalsForValue(value: string): CatalogVertical[] {
  const text = value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  // Negated/offered-by-others prose is not an affirmative category claim.
  if (/\b(?:no|not|without|doesn['’]?t|don['’]?t|unavailable)\b/.test(text)) return [];
  const matches: CatalogVertical[] = [];
  if (/\b(?:nails?|manicur(?:e|es|ist|ists)|pedicur(?:e|es|ist|ists))\b/.test(text)) matches.push("Nail");
  if (/^(?:hair|hair care|hair salon)$/.test(text) || /\b(?:haircuts?|hairdresser|hairstylist|hair stylist|hair styling|hair color(?:ing|ist)?|hair extensions|balayage|blowouts?)\b/.test(text)) matches.push("Hair");
  if (/\b(?:skin care|skincare|skin|facials?|esthetic(?:ian|s)|aesthetician|dermaplaning|microdermabrasion)\b/.test(text)) matches.push("Skin");
  if (/\b(?:lashes?|eyelashes?)\b/.test(text)) matches.push("Lash");
  if (/\b(?:brows?|eyebrows?|microblading)\b/.test(text)) matches.push("Brow");
  if (/\b(?:makeup|make up|cosmetics artist)\b/.test(text)) matches.push("Makeup");
  if (/\b(?:massage|masseuse|masseur)\b/.test(text)) matches.push("Massage");
  if (/\b(?:waxing|wax|sugaring)\b/.test(text)) matches.push("Waxing");
  if (/\b(?:barber|barbers|barbershop|barbering)\b/.test(text)) matches.push("Barber");
  if (text === "other") matches.push("Other");
  return matches;
}

/** Exact source-scoped projection. No city, address, polygon, intake-wide or identity inference. */
export function projectCatalogMapping(data: Record<string, unknown>, sourceRef: CatalogSourceRef, facts: readonly CatalogFactClaim[] = []): Pick<CatalogRecord, "market" | "marketId" | "vertical" | "verticals" | "mapping"> {
  const field = (sourceField: string, value: unknown): CatalogMappingEvidence[] => {
    const text = str(value);
    return known(text) ? [{ value: text, sourceRef, sourceField, basis: "explicit_source_field" }] : [];
  };
  const fromFact = (fact: CatalogFactClaim): CatalogMappingEvidence => ({ value: fact.value, sourceRef: fact.sourceRef, sourceField: fact.sourceField, basis: "attributed_fact", sourceUrl: fact.sourceUrl });
  // Attribution and source-reported status are both necessary; review approval is not attribution.
  const attributed = facts.filter((fact) => fact.status === "source_reported" && (fact.attribution === "candidate" || fact.attribution === "business") && known(fact.value));
  const containers: Array<{ record: Record<string, unknown>; path: string }> = [];
  const identity = (value: string) => norm(value).replace(/[^a-z0-9]/g, "");
  const expectedName = identity(str(data.displayName));
  const handle = (value: unknown) => str(value).toLowerCase().replace(/^@/, "");
  const instagramHandleFromUrl = (value: unknown) => {
    try { const url = new URL(str(value)); return /^(?:www\.)?instagram\.com$/i.test(url.hostname) && /^\/[a-z0-9._]+\/?$/i.test(url.pathname) ? handle(url.pathname.replace(/\//g, "")) : ""; } catch { return ""; }
  };
  const expectedHandle = handle(data.instagramHandle) || instagramHandleFromUrl(data.instagramProfileUrl);
  const eligible = (record: Record<string, unknown>, nested: boolean) => {
    if (["unknown", "unresolved"].includes(str(record.attribution)) || record.signalType === "client_tagged"
      || /^(?:client_post|mention|comment|tagged|review)$/.test(str(record.evidenceType))) return false;
    if (!nested || sourceRef.collection === "tech_index") return true;
    const name = ["displayName", "name", "fullName", "full_name", "operatorName", "techName"].map((key) => str(record[key])).find(Boolean);
    const owner = ["username", "handle", "ownerUsername", "owner_username", "instagramHandle", "instagram_handle"].map((key) => handle(record[key])).find(Boolean);
    return !(name && expectedName && identity(name) !== expectedName) && !(owner && expectedHandle && owner !== expectedHandle);
  };
  const visit = (record: Record<string, unknown>, path: string, depth: number) => {
    if (depth > 3 || !eligible(record, !!path)) return;
    containers.push({ record, path });
    // Candidate-owned import wrappers only; no staff, authors, reviews, addresses or batch containers.
    for (const key of ["raw", "sourceRecord", "source_record", "original"]) {
      const child = obj(record[key]);
      if (Object.keys(child).length) visit(child, path ? `${path}.${key}` : key, depth + 1);
    }
  };
  visit(data, "", 0);
  if (sourceRef.collection === "adminPipelineParsedCandidates" && typeof data.rawBlock === "string" && eligible(data, false)) {
    try { visit(obj(JSON.parse(data.rawBlock)), "rawBlock", 1); } catch { /* Never extract mapping claims from free text. */ }
  }
  const names: CatalogMappingEvidence[] = [], ids: CatalogMappingEvidence[] = [], regions: CatalogMappingEvidence[] = [];
  for (const { record, path } of containers) {
    const at = (key: string) => path ? `${path}.${key}` : key;
    const market = obj(record.market);
    names.push(...field(at("marketName"), record.marketName), ...field(at("market_name"), record.market_name), ...field(at("market"), record.market), ...field(at("market.name"), market.name), ...field(at("market.label"), market.label));
    ids.push(...field(at("marketId"), record.marketId), ...field(at("market_id"), record.market_id), ...field(at("market.id"), market.id));
    regions.push(...field(at("region"), record.region), ...field(at("regionName"), record.regionName), ...field(at("region_name"), record.region_name), ...field(at("region.name"), obj(record.region).name));
  }
  const marketFacts = attributed.filter((fact) => /^(?:market|market_name|marketname)$/.test(fact.kind.toLowerCase())).map(fromFact);
  const regionFacts = [...regions, ...attributed.filter((fact) => /^(?:region|region_name)$/.test(fact.kind.toLowerCase())).map(fromFact)];
  const nameClaims = [...names, ...marketFacts];
  const selected = nameClaims.length ? nameClaims : ids.length ? ids : regionFacts;
  const distinct = (evidence: CatalogMappingEvidence[]) => [...new Set(evidence.map((entry) => norm(entry.value)))];
  const marketConflict = distinct(selected).length > 1 || distinct(ids).length > 1;
  const marketMapping: CatalogFieldMapping = {
    status: marketConflict ? "conflict" : selected.length ? "source_reported" : "unknown",
    evidence: [...names, ...ids, ...marketFacts, ...regionFacts],
    reason: marketConflict ? "Conflicting source market claims; no market selected." : selected.length ? "Explicit source market or attributed region claim; no geographic inference." : "No explicit source market or attributed region claim. City and area are not markets.",
  };

  const verticalEvidence: CatalogMappingEvidence[] = [];
  // Only names from explicitly scoped service/category containers are accepted. Do not recurse into staff/reviews.
  const collect = (value: unknown, path: string, depth = 0): void => {
    if (depth > 2) return;
    if (Array.isArray(value)) { value.forEach((entry, index) => collect(entry, `${path}[${index}]`, depth + 1)); return; }
    if (typeof value === "string") { verticalEvidence.push(...field(path, value)); return; }
    const record = obj(value);
    for (const key of ["name", "label", "type"]) if (typeof record[key] === "string") verticalEvidence.push(...field(`${path}.${key}`, record[key]));
  };
  for (const { record, path } of containers) {
    const at = (key: string) => path ? `${path}.${key}` : key;
    for (const key of ["vertical", "verticals", "category", "categories", "service", "services", "serviceHint", "roleLabel", "tags"]) collect(record[key], at(key));
    collect(obj(record.premise).types, at("premise.types"));
    collect(obj(obj(record.places).best).types, at("places.best.types"));
  }
  for (const fact of attributed.filter((fact) => /^(?:vertical|category|service|services|service_hint|role)$/.test(fact.kind.toLowerCase()))) verticalEvidence.push(fromFact(fact));
  const found = new Set(verticalEvidence.flatMap((entry) => catalogVerticalsForValue(entry.value)));
  const verticals = CATALOG_VERTICALS.filter((vertical) => found.has(vertical));
  return {
    market: marketConflict ? "Unknown" : selected[0]?.value || "Unknown",
    ...(!marketConflict && ids.length && distinct(ids).length === 1 ? { marketId: ids[0].value } : {}),
    vertical: verticals.length > 1 ? "Multiple" : verticals[0] || "Unknown", verticals,
    mapping: {
      market: marketMapping,
      vertical: { status: verticals.length ? "source_reported" : "unknown", evidence: verticalEvidence, reason: verticals.length ? "Controlled mapping from explicit source categories/services; multiple services retained." : "No supported explicit source category or service; generic beauty/salon labels stay Unknown." },
    },
  };
}
