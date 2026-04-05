"use client";

import { useState } from "react";
import {
  buildEvidenceDetailLine,
  buildEvidenceHeadline,
  buildEvidenceTail,
  legacyHealthHint,
} from "@/lib/social-targets/operator-evidence";
import { getFeaturedValidationIntegrity } from "@/lib/social-targets/featured-validation-integrity";
import { isConfirmedRealNoSocial } from "@/lib/social-targets/operator-rank";
import type { SocialTarget } from "@/types/social-target";

type Props = { target: SocialTarget };

/** Compact reasoning for trust/rank; expandable for evidence strings. */
export function SocialTargetEvidence({ target }: Props) {
  const [open, setOpen] = useState(false);
  const integrity = getFeaturedValidationIntegrity(target);
  const head = buildEvidenceHeadline(target);
  const detail = buildEvidenceDetailLine(target);
  const tail = buildEvidenceTail(target);
  const hint = legacyHealthHint(target);
  const noSocialAnchorHint = isConfirmedRealNoSocial(target)
    ? "Real business anchor confirmed; no verified social footprint."
    : null;
  const integrityLine =
    integrity.reason && integrity.reason !== "Featured profile verified and fresh" ? integrity.reason : null;
  const extra = [...(hint ? [hint] : []), ...(integrityLine ? [integrityLine] : []), ...tail];

  return (
    <div className="mt-1 max-w-[280px] text-[10px] leading-snug text-neutral-600">
      {noSocialAnchorHint ? <p className="mb-0.5 text-neutral-700">{noSocialAnchorHint}</p> : null}
      <p className="text-neutral-700">{head}</p>
      {detail ? <p className="mt-0.5 text-neutral-500">{detail}</p> : null}
      {extra.length > 0 ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-0.5 text-[9px] font-semibold text-sky-800 underline-offset-2 hover:underline"
        >
          {open ? "Hide notes" : "Why? + notes"}
        </button>
      ) : null}
      {open && extra.length > 0 ? (
        <ul className="mt-1 list-inside list-disc space-y-0.5 text-[9px] text-neutral-500">
          {extra.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
