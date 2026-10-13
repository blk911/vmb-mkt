import { createHash } from "node:crypto";
import { fetchPublicProfile, PROFILE_FETCH_LIMITS, type ProfileFetchDependencies } from "./profile-fetch";
import { inspectProfilePage } from "./profile-evidence";
import { classifyProfileUrl } from "./profile-model";
import type { CandidateProfile, ProfileLink, ProfileObservation, ProfileRefinementStatus } from "./profile-types";

export type ProfileRefinementDependencies = ProfileFetchDependencies;
const DAY_MS = 24 * 60 * 60 * 1000;
function priority(link: ProfileLink): number {
  if (link.kind === "individual" && link.attribution === "candidate") return 0;
  if (link.platform && link.platform !== "unknown" && link.kind !== "directory") return 1;
  return link.attribution === "candidate" ? 2 : 3;
}
function eligible(link: ProfileLink): boolean {
  if (["social", "directory"].includes(link.kind)) return false;
  const classified = classifyProfileUrl(link.url);
  if (classified?.kind === "social" || classified?.kind === "directory") return false;
  // Generated search queries and directory pages are never profile observations.
  try {
    const url = new URL(link.url);
    if (/(?:^|\.)(?:google|bing|yahoo|duckduckgo)\.(?:com|net)$/.test(url.hostname) || /\/(?:search|directory|search-results)(?:\/|$)/i.test(url.pathname)) return false;
  } catch { /* The safe transport records malformed known URLs as unsafe. */ }
  return true;
}
function addLink(profile: CandidateProfile, link: ProfileLink, budget: { remaining: number; truncated: boolean }): boolean {
  const collection = link.kind === "social" ? profile.socialLinks : link.platform && link.platform !== "unknown" ? profile.bookingLinks : profile.websiteLinks;
  if (collection.some((existing) => existing.url === link.url && existing.attribution === link.attribution && existing.sourceUrl === link.sourceUrl)) return true;
  if (budget.remaining <= 0) { budget.truncated = true; return false; }
  collection.push(link);
  budget.remaining--;
  return true;
}
function failureStatus(observation: ProfileObservation): ProfileRefinementStatus {
  if (observation.outcome === "blocked") return "blocked";
  if (observation.outcome === "unavailable") return "unavailable";
  if (observation.outcome === "unsupported") return "unsupported";
  return "error";
}
/** Bounded observation of an already-linked public trail. Never searches, authenticates, or verifies licensing/ownership. */
export async function refineCandidateProfile(base: CandidateProfile, deps: ProfileRefinementDependencies = {}): Promise<CandidateProfile> {
  const now = deps.now ?? Date.now;
  const started = now();
  const attemptedAt = new Date(started).toISOString();
  const deadline = started + PROFILE_FETCH_LIMITS.deadlineMs;
  const profile: CandidateProfile = {
    ...base,
    bookingLinks: base.bookingLinks.map((link) => ({ ...link })),
    socialLinks: base.socialLinks.map((link) => ({ ...link })),
    websiteLinks: base.websiteLinks.map((link) => ({ ...link })),
    observations: base.observations.map((observation) => ({ ...observation, claims: observation.claims.map((claim) => ({ ...claim })) })),
    reasons: [...base.reasons],
    lastAttemptAt: attemptedAt,
    nextAttemptAt: new Date(started + DAY_MS).toISOString(),
    searchStatus: "unsupported",
  };
  const reason = (value: string) => { if (!profile.reasons.includes(value)) profile.reasons.push(value); };
  const queue = [...base.bookingLinks, ...base.websiteLinks].filter(eligible).sort((a, b) => priority(a) - priority(b));
  const visited = new Set<string>();
  const linkBudget = { remaining: 24, truncated: false };
  let best: "individual" | "shared" | "ambiguous" | "unmatched" = "unmatched";
  let lastFailure: ProfileObservation | undefined;
  let attempted = 0;
  if (!queue.length) {
    profile.status = base.bookingLinks.some((link) => link.kind === "directory") ? "directory_linked" : "unsupported";
    reason("No exact, observed public profile or website URL is available to follow.");
  }
  while (queue.length && attempted < PROFILE_FETCH_LIMITS.maxPages) {
    const link = queue.shift()!;
    if (visited.has(link.url)) continue;
    visited.add(link.url);
    attempted++;
    const fetchedAt = new Date(now()).toISOString();
    const result = await fetchPublicProfile(link.url, deps, deadline);
    if (result.finalUrl) visited.add(result.finalUrl);
    const observation: ProfileObservation = {
      sourceUrl: link.url,
      finalUrl: result.finalUrl,
      fetchedAt,
      outcome: result.outcome,
      httpStatus: result.httpStatus,
      claims: [],
    };
    if (result.outcome !== "retrieved" || result.body === undefined || !result.finalUrl) {
      profile.observations.push(observation);
      lastFailure = observation;
      reason(`${result.outcome}: ${result.reason}`);
      // Access failure ends this trail; never try alternate routes to a blocked/protected resource.
      break;
    }
    observation.contentHash = createHash("sha256").update(result.body).digest("hex");
    const finalClassification = classifyProfileUrl(result.finalUrl);
    if (finalClassification?.kind === "directory" || /\/(?:search|directory|search-results)(?:\/|$)/i.test(new URL(result.finalUrl).pathname)) {
      observation.outcome = "unsupported";
      profile.observations.push(observation);
      lastFailure = observation;
      reason("Final URL is a directory or search page; it cannot establish a verified provider profile.");
      break;
    }
    const evidence = inspectProfilePage(result.body, profile, result.finalUrl, fetchedAt);
    observation.claims = evidence.claims;
    profile.observations.push(observation);
    for (const value of evidence.reasons) reason(value);
    if (evidence.match === "ambiguous") {
      if (best === "unmatched") best = "ambiguous";
      break;
    }
    // An uninformative public page may be a JS shell. Continue only the existing observed queue;
    // it contributes no derived links, identity claims, or guessed fallback URLs.
    if (evidence.match === "unmatched") continue;
    if (evidence.match === "individual" || best !== "individual") best = evidence.match;
    profile.lastSuccessfulAt = fetchedAt;
    profile.freshness = "current_check";
    const classified = classifyProfileUrl(result.finalUrl);
    if (classified && classified.kind !== "directory") {
      const pageLink: ProfileLink = { ...classified, kind: evidence.match === "individual" && classified.platform !== "unknown" ? "individual" : classified.kind === "unknown" ? "website" : classified.kind,
        attribution: evidence.match === "individual" ? "candidate" : "business", sourceUrl: link.url, basis: "linked_page", observedAt: fetchedAt };
      addLink(profile, pageLink, linkBudget);
      if (profile.platform === "unknown" && classified.platform !== "unknown") {
        profile.platform = classified.platform;
        profile.platformLabel = ({ vagaro: "Vagaro", glossgenius: "GlossGenius", booksy: "Booksy", fresha: "Fresha", square: "Square", unknown: "Unknown platform" })[classified.platform];
      }
      if (!profile.providerId && pageLink.attribution === "candidate" && classified.providerId) profile.providerId = classified.providerId;
      if (!profile.businessId && classified.businessId) profile.businessId = classified.businessId;
    }
    for (const field of ["city", "state", "postalCode"] as const) {
      const found = evidence[field];
      if (!found) continue;
      if (!profile[field]) profile[field] = found;
      else if (profile[field]!.toLowerCase() !== found.toLowerCase()) reason(`Source location differs from the existing ${field}; existing value retained.`);
    }
    for (const discovered of evidence.links) {
      if (!addLink(profile, discovered, linkBudget)) continue;
      if (discovered.attribution === "candidate" && discovered.platform === profile.platform && !profile.providerId && discovered.providerId) profile.providerId = discovered.providerId;
      // A shared page's generic navigation cannot become a guessed personal trail.
      if (eligible(discovered) && discovered.attribution === "candidate" && !visited.has(discovered.url)) queue.push(discovered);
    }
    queue.sort((a, b) => priority(a) - priority(b));
  }
  if (best === "individual") profile.status = "provider_matched";
  else if (best === "shared") profile.status = "shared_page_only";
  else if (best === "ambiguous") profile.status = "ambiguous";
  else if (lastFailure) profile.status = failureStatus(lastFailure);
  else if (attempted) profile.status = "unmatched";
  if (best === "unmatched" || best === "ambiguous") {
    const last = base.lastSuccessfulAt ? Date.parse(base.lastSuccessfulAt) : NaN;
    profile.freshness = Number.isFinite(last) && started - last > 30 * DAY_MS ? "stale" : base.freshness === "current_check" ? "source_reported" : base.freshness;
  }
  const hasPersonalBooking = profile.bookingLinks.some((link) => link.kind === "individual" && link.attribution === "candidate");
  const hasPersonalSocial = profile.socialLinks.some((link) => link.attribution === "candidate");
  if (linkBudget.truncated) reason("Additional derived links were omitted at the 24-link refinement limit.");
  const incomplete = linkBudget.truncated || profile.reasons.some((value) => value.includes("12-link evidence limit")) || profile.status !== "provider_matched" || !hasPersonalBooking || !hasPersonalSocial || !!lastFailure || queue.some((link) => !visited.has(link.url));
  profile.searchStatus = incomplete ? "unsupported" : "not_needed";
  if (incomplete) reason("Linked trail is incomplete; broader name, salon, and platform web search is unsupported.");
  if (attempted >= PROFILE_FETCH_LIMITS.maxPages && queue.some((link) => !visited.has(link.url))) reason("Stopped at the three-page public profile limit.");
  return profile;
}
