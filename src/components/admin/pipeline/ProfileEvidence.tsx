import type { CandidateProfile, ProfileLink } from "@/lib/admin/pipeline/profile-types";
import { profileFreshnessLabel, profileLinkLabel, profileStatusLabel, safeProfileHref, profilePlatformLabel, profilePlatformExplanation, profileMissingLinkLabel, profileFactCoverage } from "@/lib/admin/pipeline/profile-presentation";

export function SourceLink({ url, label }: { url?: string; label?: string }) {
  const href = safeProfileHref(url);
  if (!href) return <span className="text-gray-500">{url ? "Link unavailable" : "Unknown"}</span>;
  return <a className="break-all text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2" href={href} title={url} target="_blank" rel="noopener noreferrer">{label || url}</a>;
}

export function ProfileLinks({ links, empty = "Not collected", compact = false, kind }: { links: ProfileLink[]; empty?: string; compact?: boolean; kind?: "booking" | "social" | "website" }) {
  if (compact) {
    const safeLinks = links.filter((link) => safeProfileHref(link.url));
    if (!safeLinks.length) return <span className="text-gray-500" title={empty === "Not collected" ? "No attributable link collected" : empty}>Unkwn</span>;
    return <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {safeLinks.slice(0, 2).map((link, index) => {
        const href = safeProfileHref(link.url)!;
        const hostname = new URL(href).hostname.toLowerCase();
        const label = kind === "social" || link.kind === "social" ? (hostname === "instagram.com" || hostname.endsWith(".instagram.com") ? "IG" : hostname === "facebook.com" || hostname.endsWith(".facebook.com") ? "FB" : "Social") : kind === "website" || link.kind === "website" && link.purpose !== "booking" && kind !== "booking" ? "Web" : "Booking";
        const attribution = link.attribution === "candidate" ? "Source-linked to provider" : link.attribution === "business" ? "Shared business link; not individual verification" : "Attribution unresolved; review evidence";
        return <a key={`${link.url}:${index}`} className="whitespace-nowrap text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2" href={href} target="_blank" rel="noopener noreferrer" title={`${attribution} · ${href}`} aria-label={`${label}: ${attribution}`}>{label}{link.attribution === "unresolved" ? "?" : ""}</a>;
      })}
      {safeLinks.length > 2 ? <span className="text-[10px] text-gray-500" title="Open details for every source link">+{safeLinks.length - 2}</span> : null}
    </span>;
  }
  if (!links.length) return <span className="text-gray-500">{empty}</span>;
  const shown = links;
  return <div className="space-y-2">
    {shown.map((link, index) => <div key={`${link.url}:${index}`}>
      <SourceLink url={link.url} label={profileLinkLabel(link)} />
      <div className="mt-0.5 break-all text-[11px] text-gray-500">{safeProfileHref(link.url) ? link.url : "Unsafe or invalid URL withheld"}</div>
      <div className="mt-0.5 text-[11px] text-gray-600">
        {link.attribution === "candidate" ? "Candidate-linked" : link.attribution === "business" ? "Business-linked" : "Attribution unresolved"}
        {" · "}<SourceLink url={link.sourceUrl} label={link.basis === "linked_page" ? "Linked-page source" : link.basis === "directory_card" ? "Directory source" : "Submitted source"} />
      </div>
    </div>)}
  </div>;
}

export function ProfileCheckState({ profile }: { profile?: CandidateProfile }) {
  return <div className="space-y-1 text-xs">
    <div className={profile?.status === "blocked" || profile?.status === "error" || profile?.status === "ambiguous" ? "font-medium text-amber-800" : "font-medium text-gray-700"}>{profileStatusLabel(profile)}</div>
    <div className="text-gray-500">{profileFreshnessLabel(profile)}</div>
    <div className="text-gray-500">Last checked: {profile?.lastAttemptAt ? <time dateTime={profile.lastAttemptAt}>{profile.lastAttemptAt.replace("T", " ").replace(/\.\d+Z$/, " UTC")}</time> : "Not yet"}</div>
  </div>;
}

export function ProfileSummaryCard({ profile }: { profile?: CandidateProfile }) {
  const coverage = profileFactCoverage(profile);
  return <section className="break-words rounded-xl border border-blue-100 bg-white p-4 shadow xl:col-span-2">
    <h2 className="font-bold">Source-linked profile</h2>
    <p className="mt-1 text-sm text-gray-600">Source claims and retrieval results support review. They do not establish identity, license, ownership, or approval.</p>
    <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
      <div><dt className="text-gray-500">Recognized booking platforms</dt><dd className="font-medium">{profilePlatformLabel(profile)}</dd><dd className="mt-1 text-xs text-gray-500">{profilePlatformExplanation(profile)}</dd></div>
      <div><dt className="text-gray-500">Profile / booking link</dt><dd className="mt-1"><ProfileLinks links={profile?.bookingLinks || []} empty={profileMissingLinkLabel(profile)} /></dd></div>
      <div><dt className="text-gray-500">Social link</dt><dd className="mt-1"><ProfileLinks links={profile?.socialLinks || []} empty={profileMissingLinkLabel(profile, "social")} /></dd></div>
      <div><dt className="text-gray-500">Provider (source-reported)</dt><dd>{profile?.providerName || "Not collected"}</dd></div>
      <div><dt className="text-gray-500">Salon / business (source-reported)</dt><dd>{profile?.businessName || "Not collected"}</dd></div>
      <div><dt className="text-gray-500">City / ZIP (source-reported)</dt><dd>{[profile?.city, profile?.state, profile?.postalCode].filter(Boolean).join(", ") || "Not collected"}</dd></div>
      <div><dt className="text-gray-500">Website</dt><dd className="mt-1"><ProfileLinks links={profile?.websiteLinks || []} /></dd></div>
      <div><dt className="text-gray-500">Platform identifiers</dt><dd className="break-all">Provider: {profile?.providerId || "Not collected"}<br />Business: {profile?.businessId || "Not collected"}</dd></div>
      <div><dt className="text-gray-500">Retrieval status</dt><dd className="mt-1"><ProfileCheckState profile={profile} /></dd></div>
    </dl>
    <p className="mt-4 text-sm text-gray-600">Fact coverage: {coverage.collected}/{coverage.total} fields or link types collected.{coverage.conflicts ? ` ${coverage.conflicts} source differences need review.` : ""} Collection is separate from verification or approval.</p>
    {profile?.fieldEvidence?.length ? <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold">Source-attributed facts ({profile.fieldEvidence.length})</summary><ul className="mt-2 space-y-2">{profile.fieldEvidence.map((fact, index) => <li key={`${fact.field}:${fact.value}:${index}`} className="rounded border border-gray-200 p-2"><span className="font-medium">{fact.field.replace(/([A-Z])/g, " $1")}: {fact.value}</span><div className="mt-1 text-xs text-gray-600">{fact.sourceUrl ? <SourceLink url={fact.sourceUrl} label="Open fact source" /> : "Stored source evidence"}{fact.sourceField ? ` · ${fact.sourceField}` : ""}{fact.sourceRef ? ` · ${fact.sourceRef}` : ""}</div></li>)}</ul></details> : null}
    {profile?.sourceContextUrl ? <p className="mt-4 text-sm"><SourceLink url={profile.sourceContextUrl} label="Original source context" /></p> : null}
    {profile?.reasons.length ? <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold">Collection notes ({profile.reasons.length})</summary><ul className="mt-2 list-inside list-disc space-y-1 text-gray-700">{profile.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul></details> : null}
    {profile?.nextAttemptAt ? <p className="mt-3 text-xs text-gray-500">Next eligible check: <time dateTime={profile.nextAttemptAt}>{profile.nextAttemptAt}</time></p> : null}
    {profile?.searchStatus === "unsupported" ? <p className="mt-2 text-xs text-amber-800">Name + salon + platform search is unavailable. Missing links remain unresolved.</p> : null}
    <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold">Fetched observations ({profile?.observations.length || 0})</summary>
    {profile?.observations.length ? <ul className="mt-2 space-y-3 text-sm">
      {profile.observations.map((observation, index) => <li className="rounded-lg border border-gray-200 p-3" key={`${observation.sourceUrl}:${index}`}>
        <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{observation.outcome === "blocked" ? "Protected / access blocked" : observation.outcome.replaceAll("_", " ")}{observation.httpStatus ? ` (HTTP ${observation.httpStatus})` : ""}</span><time className="text-xs text-gray-500" dateTime={observation.fetchedAt}>{observation.fetchedAt}</time></div>
        <div className="mt-1"><SourceLink url={observation.sourceUrl} /></div>
        {observation.finalUrl && observation.finalUrl !== observation.sourceUrl ? <div className="mt-1">Final page: <SourceLink url={observation.finalUrl} /></div> : null}
        {observation.claims.length ? <ul className="mt-2 space-y-1 text-gray-700">{observation.claims.map((claim, claimIndex) => <li key={claimIndex}>{claim.type.replaceAll("_", " ")}: {claim.value}</li>)}</ul> : <p className="mt-2 text-gray-500">No additional claims recovered.</p>}
      </li>)}
    </ul> : <p className="mt-2 text-sm text-gray-500">No fetched observations yet. Known source-reported details remain visible above.</p>}</details>
  </section>;
}
