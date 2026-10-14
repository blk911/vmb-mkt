import type { BookingPlatform, CandidateProfile, ProfileLink } from "@/lib/admin/pipeline/profile-types";
import { classifyProfileUrl, PLATFORM_LABELS } from "@/lib/admin/pipeline/profile-model";
import { profileKnownPlatforms, safeProfileHref } from "@/lib/admin/pipeline/profile-presentation";
import { ProfileLinks } from "@/components/admin/pipeline/ProfileEvidence";

const shortLabel = (platform: BookingPlatform) => platform === "glossgenius" ? "GG" : platform === "unknown" ? "Booking" : PLATFORM_LABELS[platform];
const linkPriority = (link: ProfileLink) => link.attribution === "candidate" ? link.kind === "individual" ? 0 : 1 : link.attribution === "business" ? 2 : 3;

/** Remove repeated quick links without altering their underlying evidence. */
export function CatalogContactLinks({ profile, hideEmpty = false }: { profile?: CandidateProfile; hideEmpty?: boolean }) {
  const uniqueSafeLinks = (links: ProfileLink[]) => {
    const byUrl = new Map<string, ProfileLink>();
    for (const link of links) {
      const href = safeProfileHref(link.url);
      if (!href) continue;
      const previous = byUrl.get(href);
      if (!previous || linkPriority(link) < linkPriority(previous)) byUrl.set(href, link);
    }
    return [...byUrl.values()];
  };
  const socialLinks = uniqueSafeLinks(profile?.socialLinks || []);
  const representedUrls = new Set([...socialLinks, ...(profile?.bookingLinks || []).filter((link) => link.kind !== "directory")].map((link) => safeProfileHref(link.url)).filter(Boolean));
  const websiteLinks = uniqueSafeLinks(profile?.websiteLinks || []).filter((link) => !representedUrls.has(safeProfileHref(link.url)));
  if (!socialLinks.length && !websiteLinks.length) return hideEmpty ? null : <ProfileLinks links={[]} compact />;
  return <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
    {socialLinks.length ? <ProfileLinks links={socialLinks} kind="social" compact /> : null}
    {websiteLinks.length ? <ProfileLinks links={websiteLinks} kind="website" compact /> : null}
  </span>;
}

/** Platform labels describe source links, never a verified provider identity. */
export default function BookingPlatformLinks({ profile }: { profile?: CandidateProfile }) {
  const safeLinks = (profile?.bookingLinks || []).flatMap((link) => {
    const href = safeProfileHref(link.url);
    if (!href || link.kind === "directory") return [];
    const detected = classifyProfileUrl(href)?.platform;
    const platform = detected && detected !== "unknown" ? detected : link.platform || "unknown";
    return [{ link, href, platform }];
  });
  // Compact presentation only. All source entries remain available in evidence.
  const byUrl = new Map<string, (typeof safeLinks)[number]>();
  for (const entry of safeLinks) {
    const previous = byUrl.get(entry.href);
    if (!previous || linkPriority(entry.link) < linkPriority(previous.link)) byUrl.set(entry.href, entry);
  }
  const uniqueLinks = [...byUrl.values()];
  const byPlatform = new Map<BookingPlatform, (typeof safeLinks)[number]>();
  for (const entry of uniqueLinks) {
    const previous = byPlatform.get(entry.platform);
    if (!previous || linkPriority(entry.link) < linkPriority(previous.link)) byPlatform.set(entry.platform, entry);
  }
  const links = [...byPlatform.values()];
  const additionalLinks = uniqueLinks.length - links.length;
  const unlinkedPlatforms = profileKnownPlatforms(profile).filter((platform) => !links.some((entry) => entry.platform === platform));
  if (!links.length && !unlinkedPlatforms.length) return <span className="text-gray-500" title="No attributable booking platform or safe booking link collected">Unkwn</span>;
  return <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
    {links.map(({ link, href, platform }, index) => {
      const label = shortLabel(platform);
      const attribution = link.attribution === "candidate" ? "Source-linked to provider; identity not verified" : link.attribution === "business" ? "Shared business link; not individual verification" : "Attribution unresolved; review evidence";
      const source = safeProfileHref(link.sourceUrl);
      const description = `${label}: ${attribution}`;
      return <a key={`${href}:${index}`} className="whitespace-nowrap text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2" href={href} target="_blank" rel="noopener noreferrer" title={`${description} · ${href}${source ? ` · Source: ${source}` : ""}`} aria-label={description}>{label}{link.attribution === "unresolved" ? "?" : ""}</a>;
    })}
    {unlinkedPlatforms.map((platform) => <span key={platform} className="text-gray-500" title="Source-reported platform; booking link unavailable. Identity is not verified.">{shortLabel(platform)}</span>)}
    {additionalLinks ? <span className="text-[10px] text-gray-500" title={`${additionalLinks} more booking source ${additionalLinks === 1 ? "link" : "links"} in Evidence & review`} aria-label={`${additionalLinks} more booking source ${additionalLinks === 1 ? "link" : "links"} in Evidence & review`}>+{additionalLinks}</span> : null}
  </span>;
}
