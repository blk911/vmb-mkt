import type { UnknownResolverRecord } from "./resolver-types";

export type NailsFirstTouchScripts = {
  phoneScript: string;
  dmScript: string;
  emailScript: string;
};

const norm = (s: string | null | undefined) => s?.trim() ?? "";

export function deriveNailsFirstTouchPlan(record: UnknownResolverRecord): string {
  const phone = !!record.phone?.trim();
  const email = !!record.email?.trim();
  const web = !!record.websiteUrl?.trim();
  const book = !!record.bookingUrl?.trim();
  const ig = !!record.instagramHandle?.trim();
  const fb = !!record.facebookUrl?.trim();

  if (!phone && !email && !web && !book && !ig && !fb) {
    return "Research pass: add phone, booking link, or social before outreach.";
  }
  if (book && (web || book)) {
    return "Lead with booking / quiet-day client-fill angle.";
  }
  if (phone) {
    return "Call first; mention fill-rate for nail books, then text a one-liner if mobile.";
  }
  if (ig && !phone && !email && !web && !book) {
    return "DM-first — reference their set / art feed in one line.";
  }
  if (email && web) {
    return "Email-first with concise pilot; link to site credibility.";
  }
  if (email) {
    return "Short email: weekday gaps + easy pilot for nail books.";
  }
  if (fb) {
    return "Messenger-first soft intro; ask for booking link.";
  }
  return "Use the strongest channel: booking > phone > IG > email.";
}

export function buildNailsFirstTouchScripts(record: UnknownResolverRecord): NailsFirstTouchScripts {
  const biz = norm(record.sourceName) || norm(record.normalizedName) || "your studio";
  const city = norm(record.city) || "your area";

  return {
    phoneScript: `Hi, it’s [your name] with VenMeBaby — we help nail techs and salons in ${city} fill slow chairs with short pilots. Quick question about ${biz}: do you have 60 seconds?`,
    dmScript: `Hey ${biz} — VenMeBaby here. We’re pairing with nail artists in ${city} on filling weekday books. Open to a 2-line fit check?`,
    emailScript: `Subject: Weekday books / ${city}\n\nHi ${biz},\n\nWe work with nail salons and solo techs on filling slow days with simple pilots (no long contract). Worth a quick call this week?\n\n[Your name]\nVenMeBaby`,
  };
}
