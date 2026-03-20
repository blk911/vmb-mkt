import type { BeautyZoneMember } from "@/lib/markets";

export type PresenceMember = Pick<
  BeautyZoneMember,
  | "instagram_url"
  | "instagram_handle"
  | "facebook_url"
  | "tiktok_url"
  | "yelp_url"
  | "linktree_url"
  | "booking_url"
  | "booking_provider"
>;

function nonempty(v: string | null | undefined): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Short display label for known booking provider ids (site_identity). */
export function formatBookingProviderLabel(provider: string): string {
  const p = provider.trim().toLowerCase();
  const map: Record<string, string> = {
    vagaro: "Vagaro",
    glossgenius: "GlossGenius",
    square: "Square",
    booksy: "Booksy",
    fresha: "Fresha",
    acuityscheduling: "Acuity",
    schedulicity: "Schedulicity",
    styleseat: "StyleSeat",
    boulevard: "Boulevard",
    mindbody: "Mindbody",
    phorest: "Phorest",
  };
  return map[p] ?? p.charAt(0).toUpperCase() + p.slice(1);
}

type LinkBadge = { key: string; label: string; href: string; title: string };

/**
 * Compact outbound-link presence (site_identity fields on zone members). No long URLs in the label.
 */
export function PresenceBadges({
  member,
  className = "",
}: {
  member: PresenceMember;
  className?: string;
}) {
  const booking = nonempty(member.booking_provider)
    ? {
        href: nonempty(member.booking_url) ? member.booking_url! : "#",
        label: formatBookingProviderLabel(member.booking_provider!),
        title: nonempty(member.booking_url)
          ? member.booking_url!
          : `Provider: ${member.booking_provider}`,
      }
    : nonempty(member.booking_url)
      ? {
          href: member.booking_url!,
          label: "Book",
          title: member.booking_url!,
        }
      : null;

  const socials: LinkBadge[] = [];
  if (nonempty(member.instagram_url) || nonempty(member.instagram_handle)) {
    const href = nonempty(member.instagram_url)
      ? member.instagram_url!
      : `https://www.instagram.com/${member.instagram_handle}/`;
    socials.push({
      key: "ig",
      label: nonempty(member.instagram_handle) ? `@${member.instagram_handle}` : "IG",
      href,
      title: nonempty(member.instagram_url) ? member.instagram_url! : href,
    });
  }
  if (nonempty(member.facebook_url)) {
    socials.push({
      key: "fb",
      label: "FB",
      href: member.facebook_url!,
      title: member.facebook_url!,
    });
  }
  if (nonempty(member.tiktok_url)) {
    socials.push({ key: "tt", label: "TT", href: member.tiktok_url!, title: member.tiktok_url! });
  }
  if (nonempty(member.yelp_url)) {
    socials.push({
      key: "yelp",
      label: "Yelp",
      href: member.yelp_url!,
      title: member.yelp_url!,
    });
  }
  if (nonempty(member.linktree_url)) {
    socials.push({
      key: "lt",
      label: "Linktree",
      href: member.linktree_url!,
      title: member.linktree_url!,
    });
  }

  if (!booking && socials.length === 0) {
    return (
      <span className={`text-xs text-neutral-400 ${className}`} title="No social/booking signals in data">
        —
      </span>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {booking ? (
        booking.href === "#" ? (
          <span
            className="inline-flex max-w-[9rem] truncate rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-900 ring-1 ring-violet-200"
            title={booking.title}
          >
            {booking.label}
          </span>
        ) : (
          <a
            href={booking.href}
            target="_blank"
            rel="noreferrer"
            title={booking.title}
            className="inline-flex max-w-[9rem] truncate rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-900 ring-1 ring-violet-200 transition hover:bg-violet-200"
          >
            {booking.label}
          </a>
        )
      ) : null}
      {socials.map((s) => (
        <a
          key={s.key}
          href={s.href}
          target="_blank"
          rel="noreferrer"
          title={s.title}
          className="inline-flex rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50"
        >
          {s.label}
        </a>
      ))}
    </div>
  );
}

/** Optional expanded block with full URLs for reviewer copy-out. */
export function PresenceRawLinksDetails({ member }: { member: PresenceMember }) {
  const rows: { label: string; url: string }[] = [];
  const push = (label: string, v: string | null | undefined) => {
    if (nonempty(v)) rows.push({ label, url: v.trim() });
  };
  push("Instagram", member.instagram_url);
  push("Facebook", member.facebook_url);
  push("TikTok", member.tiktok_url);
  push("Yelp", member.yelp_url);
  push("Linktree", member.linktree_url);
  push("Booking", member.booking_url);
  if (rows.length === 0) return null;
  return (
    <details className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium text-neutral-700">Raw URLs (site identity)</summary>
      <ul className="mt-2 space-y-1.5 break-all text-xs text-neutral-600">
        {rows.map((r) => (
          <li key={r.label}>
            <span className="font-semibold text-neutral-800">{r.label}:</span>{" "}
            <a href={r.url} target="_blank" rel="noreferrer" className="text-sky-700 underline">
              {r.url}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
