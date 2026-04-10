"use client";

import type {
  DoraValidationResult,
  OperatorCandidateLinkSuggestion,
  SocialDiscoveryResult,
} from "@/lib/source-intake/phase2-types";

type ResolverOutcomePanelProps = {
  doraResults: DoraValidationResult[];
  socialResults: SocialDiscoveryResult[];
  operatorCandidateLinks: OperatorCandidateLinkSuggestion[];
};

export function ResolverOutcomePanel({
  doraResults,
  socialResults,
  operatorCandidateLinks,
}: ResolverOutcomePanelProps) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-neutral-900">Resolver Outcomes</h3>
        <p className="text-sm text-neutral-600">Queue results remain provenance-safe: they write evidence and link suggestions without mutating canonicals directly.</p>
      </div>

      <div className="space-y-5">
        <div>
          <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">DORA Results</h4>
          {doraResults.length ? (
            <div className="space-y-2">
              {doraResults.map((result) => (
                <div key={result.id} className="rounded-xl bg-neutral-50 px-3 py-3 text-sm">
                  <div className="font-medium text-neutral-900">
                    {result.status} {result.matchedLicenseName ? `- ${result.matchedLicenseName}` : ""}
                  </div>
                  <div className="text-neutral-700">Score: {result.score}</div>
                  <div className="text-neutral-700">Evidence IDs: {result.evidenceIds.length ? result.evidenceIds.join(", ") : "none"}</div>
                  <div className="text-xs text-neutral-500">{result.reasons.join(" | ")}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No DORA results yet.</p>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Social Results</h4>
          {socialResults.length ? (
            <div className="space-y-2">
              {socialResults.map((result) => (
                <div key={result.id} className="rounded-xl bg-neutral-50 px-3 py-3 text-sm">
                  <div className="font-medium text-neutral-900">{result.discoveredSurfaces.length} surfaces discovered</div>
                  <div className="text-neutral-700">Evidence IDs: {result.evidenceIds.length ? result.evidenceIds.join(", ") : "none"}</div>
                  <div className="mt-2 space-y-1">
                    {result.discoveredSurfaces.map((surface, index) => (
                      <div key={`${surface.type}-${index}`} className="text-xs text-neutral-600">
                        {surface.type}: {surface.value} ({surface.confidence}) - {surface.reasons.join(" | ")}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No social discovery results yet.</p>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Candidate Link Suggestions</h4>
          {operatorCandidateLinks.length ? (
            <div className="space-y-2">
              {operatorCandidateLinks.map((link) => (
                <div key={link.id} className="rounded-xl bg-neutral-50 px-3 py-3 text-sm">
                  <div className="font-medium text-neutral-900">
                    {link.targetType} {"->"} {link.targetId}
                  </div>
                  <div className="text-neutral-700">Score: {link.score}</div>
                  <div className="text-xs text-neutral-500">{link.reasons.join(" | ")}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No operator link suggestions yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
