import { classifyProfileUrl } from "./profile-model";
import { isSocialProfileHost, publicProfileUrl } from "./profile-fetch";
import type { CandidateProfile, ProfileLink, ProfileObservation } from "./profile-types";

type JsonObject = Record<string, unknown>;
interface Node { tag: string; attrs: Record<string, string>; parent: number; start: number; end: number; text: string }
interface PersonEvidence { name: string; businessNames: string[]; ids: string[]; urls: string[]; socials: string[]; address?: JsonObject; scope?: number }
export interface PageEvidence {
  match: "individual" | "shared" | "ambiguous" | "unmatched";
  links: ProfileLink[];
  claims: ProfileObservation["claims"];
  city?: string;
  state?: string;
  postalCode?: string;
  reasons: string[];
}
function decode(value: string): string {
  return value.replace(/&(?:amp|quot|apos|lt|gt|nbsp|#\d{1,7}|#x[\da-f]{1,6});/gi, (entity) => {
    const named: Record<string, string> = { "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " " };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const code = entity.toLowerCase().startsWith("&#x") ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : " ";
  });
}
function plain(value: string): string { return decode(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim(); }
function normal(value: string): string { return value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }
function exactName(a: string, b: string): boolean { return normal(a) === normal(b) && normal(b).split(" ").length >= 2; }
function containsText(text: string, query?: string): boolean { return !!query && (` ${normal(text)} `).includes(` ${normal(query)} `); }
function string(value: unknown): string { return typeof value === "string" ? value.trim().slice(0, 2048) : ""; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value.slice(0, 32) : value === undefined ? [] : [value]; }
function object(value: unknown): JsonObject | undefined { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined; }
function names(value: unknown): string[] { return array(value).map((v) => string(object(v)?.name ?? v)).filter(Boolean); }
function identifiers(value: unknown): string[] { return array(value).map((v) => string(object(v)?.value ?? object(v)?.identifier ?? v)).filter(Boolean); }
function strings(value: unknown): string[] { return array(value).map((v) => typeof v === "string" && v.trim().length <= 2048 ? v.trim() : "").filter(Boolean); }
function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s'"=<>`]+))/g;
  let found: RegExpExecArray | null;
  while ((found = re.exec(tag)) && Object.keys(out).length < 40) out[found[1].toLowerCase()] = decode(found[2] ?? found[3] ?? found[4] ?? "").slice(0, 4096);
  return out;
}
/** Share token boundaries so commented, inert, and unfinished raw-text markup cannot become evidence. */
function* htmlTokens(html: string): Generator<RegExpExecArray> {
  const re = /<!--[\s\S]*?(?:-->|$)|<(script|style|textarea|title)\b[^>]{0,8192}>[\s\S]*?(?:<\/\1\s*>|$)|<\/?[a-zA-Z][^>]{0,8192}>|[^<]+/gi;
  const inert: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const token = match[0];
    if (token.startsWith("<!--")) continue;
    const container = /^<(\/?)(template|noscript)\b/i.exec(token);
    if (container) {
      const tag = container[2].toLowerCase();
      if (!container[1]) inert.push(tag);
      else if (inert[inert.length - 1] === tag) inert.pop();
      continue;
    }
    if (!inert.length) yield match;
  }
}
/** Bounded, deliberately conservative HTML evidence reader; it does not execute JS or load resources. */
function parseNodes(html: string): Node[] {
  const nodes: Node[] = [{ tag: "root", attrs: {}, parent: -1, start: 0, end: html.length, text: "" }];
  const stack = [0];
  for (const match of htmlTokens(html)) {
    if (nodes.length >= 6000) break;
    const end = match.index + match[0].length;
    const token = match[0];
    if (/^<(script|style|textarea|title)\b/i.test(token)) continue;
    if (!token.startsWith("<")) { const node = nodes[stack[stack.length - 1]]; node.text = (node.text + " " + plain(token)).slice(0, 12000); continue; }
    const tag = /^<\/?([a-zA-Z][\w:-]*)/.exec(token)?.[1].toLowerCase();
    if (!tag) continue;
    if (token.startsWith("</")) {
      for (let i = stack.length - 1; i > 0; i--) if (nodes[stack[i]].tag === tag) {
        for (const id of stack.splice(i)) nodes[id].end = end;
        break;
      }
    } else {
      const id = nodes.length;
      nodes.push({ tag, attrs: attrs(token), parent: stack[stack.length - 1], start: match.index, end, text: "" });
      if (!/^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag) && !token.endsWith("/>") && stack.length < 64) stack.push(id);
    }
  }
  for (const id of stack) nodes[id].end = html.length;
  for (let i = nodes.length - 1; i > 0; i--) {
    const parent = nodes[nodes[i].parent];
    parent.text = (parent.text + " " + nodes[i].text).slice(0, 12000).replace(/\s+/g, " ").trim();
  }
  return nodes;
}
function inScope(nodes: Node[], id: number, scope: number): boolean {
  let current = id;
  for (let depth = 0; depth < 64 && current >= 0; depth++) { if (current === scope) return true; current = nodes[current].parent; }
  return false;
}
function jsonEntities(html: string): JsonObject[] {
  const result: JsonObject[] = [];
  const visit = (value: unknown, depth: number) => {
    if (depth > 16 || result.length >= 1200) return;
    if (Array.isArray(value)) { for (const child of value.slice(0, 200)) visit(child, depth + 1); return; }
    const node = object(value);
    if (!node) return;
    if (node["@type"]) result.push(node);
    // People inside reviews/authorship are visitors or writers, not the listed provider.
    const relations = new Set(["@graph", "mainEntity", "mainEntityOfPage", "employee", "employees", "member", "members", "worksFor", "memberOf", "affiliation", "department", "address", "itemListElement", "item"]);
    for (const [key, child] of Object.entries(node).slice(0, 60)) if (relations.has(key)) visit(child, depth + 1);
  };
  if (html.trimStart().startsWith("{")) { try { visit(JSON.parse(html), 0); } catch { /* Not JSON-LD. */ } }
  let count = 0;
  for (const token of htmlTokens(html)) {
    if (!/^<script\b/i.test(token[0])) continue;
    if (count++ >= 40) break;
    const script = /^<script\b([^>]{0,8192})>([\s\S]*?)<\/script\s*>$/i.exec(token[0]);
    if (!script || attrs(script[1]).type?.toLowerCase() !== "application/ld+json" || script[2].length > 300000) continue;
    try { visit(JSON.parse(script[2]), 0); } catch { /* Malformed structured data is not evidence. */ }
  }
  return result;
}
function hasType(entity: JsonObject, type: string): boolean { return strings(entity["@type"]).some((v) => v === type || v.endsWith(`/${type}`)); }
function resolveObservedUrl(value: string, sourceUrl: string): string | undefined {
  if (!value || value.startsWith("#") || value.length > 2048) return undefined;
  try { const url = new URL(value, sourceUrl); return publicProfileUrl(url.href)?.href; } catch { return undefined; }
}
function entityPerson(entity: JsonObject): PersonEvidence {
  return { name: string(entity.name), businessNames: [...names(entity.worksFor), ...names(entity.memberOf), ...names(entity.affiliation)], ids: identifiers(entity.identifier), urls: strings(entity.url), socials: strings(entity.sameAs), address: object(entity.address) };
}
function nonProviderContext(nodes: Node[], id: number): boolean {
  for (let current = id, depth = 0; current > 0 && depth < 64; current = nodes[current].parent, depth++) {
    const node = nodes[current];
    if (/review|comment|testimonial|author/i.test(`${node.attrs.class ?? ""} ${node.attrs.id ?? ""} ${node.attrs.itemtype ?? ""} ${node.attrs.itemprop ?? ""}`)) return true;
  }
  return false;
}
function scopedProperty(nodes: Node[], scope: number, property: string): string[] {
  return nodes.flatMap((node, id) => {
    if (!node.attrs.itemprop?.split(/\s+/).includes(property) || !inScope(nodes, id, scope)) return [];
    // A nested Person or Organization owns its own properties, including name and sameAs.
    for (let parent = node.parent; parent !== scope && parent >= 0; parent = nodes[parent].parent) if (nodes[parent].attrs.itemtype) return [];
    return [node.attrs.content || node.attrs.href || node.text].filter(Boolean);
  });
}
export function inspectProfilePage(html: string, base: CandidateProfile, finalUrl: string, observedAt: string): PageEvidence {
  const nodes = parseNodes(html);
  const entities = jsonEntities(html);
  const classification = classifyProfileUrl(finalUrl);
  const persons = entities.filter((e) => hasType(e, "Person")).map(entityPerson);
  const metadata = new Map(nodes.filter((node) => node.tag === "meta").map((node) => [node.attrs.property || node.attrs.name, node.attrs.content]));
  const metaName = [metadata.get("profile:first_name"), metadata.get("profile:last_name")].filter(Boolean).join(" ");

  const businessEntities = entities.filter((e) => ["Organization", "LocalBusiness", "HairSalon", "BeautySalon", "HealthAndBeautyBusiness"].some((type) => hasType(e, type)));
  const hasBusiness = !!base.businessName && (containsText(nodes[0].text, base.businessName) || businessEntities.some((e) => normal(string(e.name)) === normal(base.businessName!)));
  if (metaName && exactName(metaName, base.providerName) && hasBusiness) persons.push({ name: metaName, businessNames: [base.businessName!], ids: [], urls: [], socials: [] });
  let microdataPeople = 0;
  for (let id = 1; id < nodes.length && microdataPeople < 40; id++) {
    const node = nodes[id];
    if (!/(?:^|\/)Person(?:\s|$)/.test(node.attrs.itemtype ?? "") || nonProviderContext(nodes, id)) continue;
    microdataPeople++;
    persons.push({ name: scopedProperty(nodes, id, "name")[0] ?? "", businessNames: [...scopedProperty(nodes, id, "worksFor"), ...scopedProperty(nodes, id, "affiliation")], ids: scopedProperty(nodes, id, "identifier"), urls: scopedProperty(nodes, id, "url"), socials: scopedProperty(nodes, id, "sameAs"), scope: id });
  }
  const nativeIdInUrl = !!base.providerId && base.platform !== "unknown" && classification?.platform === base.platform && classification.providerId === base.providerId && (!base.businessId || !classification.businessId || classification.businessId === base.businessId);
  const sameName = persons.filter((p) => exactName(p.name, base.providerName));
  const contextual = sameName.filter((p) => (!base.providerId || !p.ids.length || p.ids.includes(base.providerId)) && p.businessNames.some((b) => !!base.businessName && normal(b) === normal(base.businessName)));
  const idPeople = persons.filter((p) => !!base.providerId && base.platform !== "unknown" && classification?.platform === base.platform && p.ids.includes(base.providerId));
  const matches = [...new Set([...contextual, ...idPeople])];
  const nameWithWrongId = !!base.providerId && sameName.some((p) => p.ids.length > 0 && !p.ids.includes(base.providerId!)) && !idPeople.length;
  const differentUrlId = !!base.providerId && classification?.platform === base.platform && !!classification.providerId && classification.providerId !== base.providerId;
  const contradictoryPerson = nativeIdInUrl && persons.length > 0 && !matches.length && persons.some((p) => (p.ids.length > 0 && !p.ids.includes(base.providerId!)) || (!!p.name && !exactName(p.name, base.providerName)) || (!!base.businessName && p.businessNames.length > 0 && !p.businessNames.some((name) => normal(name) === normal(base.businessName!))));
  const differentBusinessId = !!base.businessId && classification?.platform === base.platform && !!classification.businessId && classification.businessId !== base.businessId;
  const contradictoryIdPerson = idPeople.some((p) => (!!p.name && !exactName(p.name, base.providerName)) || (!!base.businessName && p.businessNames.length > 0 && !p.businessNames.some((name) => normal(name) === normal(base.businessName!))));
  const nativeIdConflict = nameWithWrongId || differentUrlId || differentBusinessId || contradictoryPerson || contradictoryIdPerson;
  const nativeIdMatch = nativeIdInUrl && !nativeIdConflict;
  const providerScopes: number[] = matches.flatMap((p) => p.scope === undefined ? [] : [p.scope]);
  // A full-name heading can support a staff relationship. Only its small card's links can be personal.
  const staffPage = /\/(?:staff|team|our-team|stylists)(?:\/|$)/i.test(new URL(finalUrl).pathname);
  const headings = nodes.flatMap((node, id) => {
    if (!/^h[1-6]$/.test(node.tag) || !exactName(node.text, base.providerName) || nonProviderContext(nodes, id)) return [];
    let parent = node.parent;
    let providerCard = false;
    for (let depth = 0; parent > 0 && depth < 8; depth++, parent = nodes[parent].parent) {
      const context = `${nodes[parent].attrs.class ?? ""} ${nodes[parent].attrs.id ?? ""} ${nodes[parent].attrs.itemtype ?? ""}`;
      if (/review|comment|testimonial|author/i.test(context)) return [];
      if (/staff|team|stylist|provider|employee/i.test(context)) providerCard = true;
    }
    return node.tag === "h1" || staffPage || providerCard ? [id] : [];
  }).slice(0, 40);
  for (const id of headings) {
    let scope = nodes[id].parent;
    for (let depth = 0; depth < 4 && scope > 0; depth++) {
      const node = nodes[scope];
      const headingCount = nodes.filter((child, childId) => /^h[1-6]$/.test(child.tag) && inScope(nodes, childId, scope) && child.text).length;
      if (["article", "li", "section", "div"].includes(node.tag) && node.text.length < 6000 && headingCount === 1 && hasBusiness) { providerScopes.push(scope); break; }
      scope = node.parent;
    }
  }
  const personKeys = new Set(matches.map((p) => JSON.stringify([normal(p.name), p.businessNames.map(normal).sort(), [...p.ids].sort(), [...p.urls].sort()])));
  const conflictingIdentity = matches.length > 1 && personKeys.size > 1 && new Set(matches.flatMap((p) => [...p.ids, ...p.urls])).size > 1;
  const headingRelationship = headings.length > 0 && hasBusiness;
  const anyMatch = matches.length > 0 || headingRelationship || nativeIdMatch;
  const shared = classification?.kind === "shared_business" || /\/(?:staff|team|our-team|stylists)(?:\/|$)/i.test(new URL(finalUrl).pathname) || persons.length > 1 || headings.length > 1;
  const match: PageEvidence["match"] = nativeIdConflict || conflictingIdentity || (headings.length > 1 && !nativeIdMatch) ? "ambiguous" : !anyMatch ? "unmatched" : shared && !nativeIdMatch ? "shared" : "individual";
  const reasons: string[] = [];
  const claims: PageEvidence["claims"] = [];
  const links: ProfileLink[] = [];
  const businessScopes = nodes.flatMap((node, id) => /(?:^|\/)(?:Organization|LocalBusiness|HairSalon|BeautySalon|HealthAndBeautyBusiness)(?:\s|$)/.test(node.attrs.itemtype ?? "") ? [id] : []).slice(0, 40);
  const businessUrls = new Set([
    ...businessEntities.flatMap((business) => [...strings(business.url), ...strings(business.sameAs)]),
    ...businessScopes.flatMap((scope) => [...scopedProperty(nodes, scope, "url"), ...scopedProperty(nodes, scope, "sameAs")]),
  ].map((url) => resolveObservedUrl(url, finalUrl)).filter(Boolean));
  if (match === "ambiguous") reasons.push("Multiple matching provider records have conflicting identifiers or contexts; no personal links attributed.");
  if (match === "unmatched") reasons.push("Page did not establish the full provider name with salon context or an exact platform provider identifier.");
  if (match === "shared") reasons.push("Full provider name is linked to the salon on a shared page; page-wide links remain business-attributed.");
  if (anyMatch && match !== "ambiguous" && base.businessName) claims.push({ type: "provider_business", value: `${base.providerName} | ${base.businessName}` });
  const add = (raw: string, attribution: ProfileLink["attribution"], kindHint?: ProfileLink["kind"]) => {
    const url = resolveObservedUrl(raw, finalUrl);
    if (!url || url === finalUrl) return;
    const classified = classifyProfileUrl(url);
    if (!classified || classified.kind === "directory") return;
    const isSocial = isSocialProfileHost(new URL(url).hostname);
    const kind: ProfileLink["kind"] = isSocial ? "social" : classified.kind === "unknown" ? "website" : classified.kind;
    if (kind === "website" && /\.(?:png|jpe?g|gif|webp|svg|pdf|css|js|zip)(?:$|\?)/i.test(url)) return;
    // An exact provider ID can upgrade an observed platform link, but never a page-wide social account.
    const exactProvider = !!base.providerId && classified.platform === base.platform && classified.providerId === base.providerId;
    const assigned = businessUrls.has(url) || classified.kind === "shared_business" ? "business" : !isSocial && exactProvider && match !== "ambiguous" ? "candidate" : attribution;
    if (links.some((link) => link.url === url && link.attribution === assigned)) return;
    if (links.length >= 12) {
      const limitReason = "Additional page links were omitted at the 12-link evidence limit.";
      if (!reasons.includes(limitReason)) reasons.push(limitReason);
      return;
    }
    links.push({ ...classified, url, kind: kindHint ?? kind, attribution: assigned, sourceUrl: finalUrl, basis: "linked_page", observedAt });
  };
  if (match === "individual" || match === "shared") {
    for (const person of matches) { for (const url of person.urls) add(url, "candidate"); for (const url of person.socials) add(url, "candidate"); }
    for (let id = 0; id < nodes.length; id++) {
      const node = nodes[id];
      if (node.tag !== "a" || !node.attrs.href || nonProviderContext(nodes, id)) continue;
      const href = resolveObservedUrl(node.attrs.href, finalUrl);
      if (!href) continue;
      const classified = classifyProfileUrl(href);
      const social = isSocialProfileHost(new URL(href).hostname);
      const relevant = social || (!!classified && ["individual", "shared_business"].includes(classified.kind)) || /website|web site|visit|about|book|appointment|contact|profile|team|staff/i.test(`${node.text} ${node.attrs.rel ?? ""} ${node.attrs.itemprop ?? ""}`);
      if (!relevant) continue;
      const scoped = providerScopes.some((scope) => inScope(nodes, id, scope));
      const businessScoped = businessScopes.some((scope) => inScope(nodes, id, scope));
      const personal = !businessScoped && (scoped || (match === "individual" && !shared));
      add(href, personal ? "candidate" : "business");
    }
    // Organization sameAs/URL is business evidence even on an individual provider page.
    for (const business of businessEntities.filter((e) => !!base.businessName && normal(string(e.name)) === normal(base.businessName))) {
      for (const url of [...strings(business.url), ...strings(business.sameAs)]) add(url, "business");
    }
    if (classification?.platform !== "unknown" && classification?.platform) claims.push({ type: "platform", value: classification.platform });
  }
  for (const link of links) if (link.kind === "social" || link.platform !== "unknown") claims.push({ type: link.kind === "social" ? "social_url" : "booking_url", value: `${link.attribution}: ${link.url}` });
  let address = matches.find((p) => p.address)?.address;
  if (!address && anyMatch && !conflictingIdentity) address = businessEntities.find((e) => !!base.businessName && normal(string(e.name)) === normal(base.businessName) && object(e.address))?.address as JsonObject | undefined;
  const city = match === "ambiguous" || match === "unmatched" ? undefined : string(address?.addressLocality) || undefined;
  const state = match === "ambiguous" || match === "unmatched" ? undefined : string(address?.addressRegion) || undefined;
  const postalCode = match === "ambiguous" || match === "unmatched" ? undefined : string(address?.postalCode) || undefined;
  if (city || state || postalCode) claims.push({ type: "location", value: [city, state, postalCode].filter(Boolean).join(", ") });
  return { match, links, claims: claims.slice(0, 16).map((claim) => ({ ...claim, value: claim.value.slice(0, 2200) })), reasons, city, state, postalCode };
}
