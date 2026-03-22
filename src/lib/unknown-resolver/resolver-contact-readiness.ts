import type { UnknownResolverRecord } from "./resolver-types";

export type HouseCleaningFirstTouchScripts = {
  phoneScript: string;
  dmScript: string;
  emailScript: string;
};

/** At least one non-empty contact path operators can use. */
export function hasUsableContactPath(record: UnknownResolverRecord): boolean {
  return !!(
    record.phone?.trim() ||
    record.email?.trim() ||
    record.websiteUrl?.trim() ||
    record.bookingUrl?.trim() ||
    record.instagramHandle?.trim() ||
    record.facebookUrl?.trim()
  );
}

/** Promoted + operator yes + usable path (for “ready to contact” filter). */
export function isReadyToContact(record: UnknownResolverRecord): boolean {
  return (
    record.promotedAt != null &&
    record.operatorDecision === "yes" &&
    hasUsableContactPath(record)
  );
}

/**
 * phone +30, email +25, website +20, booking +15, IG or FB +10, bestContactMethod set (not unknown) +10.
 * Clamped 0–100.
 */
export function computeContactReadinessScore(record: UnknownResolverRecord): number {
  let s = 0;
  if (record.phone?.trim()) s += 30;
  if (record.email?.trim()) s += 25;
  if (record.websiteUrl?.trim()) s += 20;
  if (record.bookingUrl?.trim()) s += 15;
  if (record.instagramHandle?.trim() || record.facebookUrl?.trim()) s += 10;
  if (record.bestContactMethod && record.bestContactMethod !== "unknown") s += 10;
  return Math.max(0, Math.min(100, s));
}

export function deriveFirstTouchPlan(record: UnknownResolverRecord): string {
  const phone = !!record.phone?.trim();
  const email = !!record.email?.trim();
  const web = !!record.websiteUrl?.trim();
  const book = !!record.bookingUrl?.trim();
  const ig = !!record.instagramHandle?.trim();
  const fb = !!record.facebookUrl?.trim();

  if (!phone && !email && !web && !book && !ig && !fb) {
    return "Research pass needed: add at least one contact path.";
  }
  if (phone) {
    return "Call first, then send short follow-up text if mobile.";
  }
  if (web && book) {
    return "Lead with booking / client-fill angle.";
  }
  if (ig && !phone && !email && !web && !book) {
    return "DM-first outreach.";
  }
  if (fb && !phone && !email && !web && !book) {
    return "Messenger-first soft intro.";
  }
  if (email) {
    return "Email first with a concise intro; offer a short pilot slot.";
  }
  if (web) {
    return "Open with site credibility; follow up via form or listed email.";
  }
  return "Pick the strongest visible channel and send one short touch.";
}

const norm = (s: string | null | undefined) => s?.trim() ?? "";

/**
 * Short, operator-usable starters (house_cleaning). Not AI — templates.
 */
export function buildHouseCleaningFirstTouchScripts(record: UnknownResolverRecord): HouseCleaningFirstTouchScripts {
  const biz = norm(record.sourceName) || norm(record.normalizedName) || "your business";
  const city = norm(record.city) || "your area";

  return {
    phoneScript: `Hi, this is [your name] with VenMeBaby — we help home cleaners in ${city} fill slow weekdays with simple pilots. Noticed ${biz}: do you have 90 seconds?`,
    dmScript: `Hey ${biz} — quick note from VenMeBaby: we’re lining up low-friction pilot cleans in ${city}. Open to a 2-line fit check?`,
    emailScript: `Subject: Weekday gaps / ${city}\n\nHi ${biz},\n\nWe partner with residential cleaners on filling slow days with short pilots (no long contract). Worth a 10-minute call this week?\n\n[Your name]\nVenMeBaby`,
  };
}

export type ContactEnrichmentDerivation = {
  firstTouchPlan: string | null;
  phoneScript: string | null;
  dmScript: string | null;
  emailScript: string | null;
  contactReadinessScore: number | null;
};

/** Recompute derived first-touch fields + readiness from current record snapshot. */
export function applyContactEnrichmentDerivation(record: UnknownResolverRecord): ContactEnrichmentDerivation {
  const scripts = buildHouseCleaningFirstTouchScripts(record);
  return {
    firstTouchPlan: deriveFirstTouchPlan(record),
    phoneScript: scripts.phoneScript,
    dmScript: scripts.dmScript,
    emailScript: scripts.emailScript,
    contactReadinessScore: computeContactReadinessScore(record),
  };
}
