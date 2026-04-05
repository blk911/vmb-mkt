---
name: vmb-validation-wheel
description: Common validation wheel for turning source evidence into confirmed live, review, dead, or suppressed salon/tech targets.
---
# Purpose
Use this skill whenever working on source ingestion, candidate discovery, target verification, target reconciliation, ranking, or operator review for VMB social targets.
This repo does not treat any single source as truth-complete.
All source evidence must pass through a common validation wheel before it is promoted into a trusted operator target.
# Core principle
Sources do not decide truth.
Sources contribute evidence.
Examples:
- Google Maps provides place/business anchor evidence
- DORA provides license/person/business legitimacy evidence
- Yelp provides candidate expansion, variant naming, and service-language evidence
- Website provides domain/social/booking-link evidence
- Booking pages provide operator/service evidence
- IG/TikTok provide live social-footprint evidence
- Referral trails provide network evidence
No source alone is enough to finalize identity unless it is strongly corroborated.
# Validation wheel
Every candidate entity or candidate profile moves through these stages:
1. Ingest
2. Normalize
3. Anchor check
4. Territory guard
5. Live check
6. Reconciliation
7. Scoring
8. Final state
# Stage definitions
## 1. Ingest
A source creates or updates a candidate.
Examples:
- Maps listing
- DORA record
- Yelp page
- Website social icon
- TikTok profile candidate
- IG handle candidate
- Booking page
- referral-derived candidate
## 2. Normalize
Convert all source records to a common candidate shape.
Minimum normalized fields:
- sourceType
- sourceUrl
- platform
- businessName
- personName
- alternateNames
- phone
- website
- address
- city
- state
- postalCode
- zone
- category
- handle
- profileUrl
- evidence
- timestamps
## 3. Anchor check
Ask:
- does this tie to a real-world operator/business anchor?
- same phone?
- same website/domain?
- same address or suite?
- same city/state?
- same category/service profile?
- DORA tie?
- Maps tie?
## 4. Territory guard
Ask:
- is this in the allowed territory?
- same state?
- same city or corridor?
- same zone?
- likely wrong-nearby false positive?
- franchise/duplicate-location confusion?
- same-name but wrong-market drift?
Territory guard is mandatory for soft sources such as Yelp, hashtags, nearby suggestions, and "also searched" branches.
## 5. Live check
Ask:
- does the candidate resolve?
- live / dead / blocked / redirect / unknown?
- recent / stale / unknown?
- does the footprint show active operator behavior?
Blocked is not dead.
Unknown is not dead.
## 6. Reconciliation
Ask:
- attach to existing target?
- create a new target?
- store as alternate candidate?
- suppress?
- send to review?
Do not force uncertain evidence into a primary identity.
## 7. Scoring
Use weighted evidence:
- anchor strength
- territory fit
- live status
- business/category fit
- activity
- source trust
- corroboration count
## 8. Final state
Allowed final states:
- confirmed_live
- confirmed_real_no_social
- verified_candidate
- candidate_review
- dead
- out_of_territory
- mismatch
- suppressed
# Trust tiers
## Tier 1 — hard anchors
Examples:
- Google Maps listing
- DORA/license
- phone match
- website domain match
- exact address/suite match
## Tier 2 — strong corroborators
Examples:
- booking page tied to domain/brand
- website social icon links
- consistent bio/domain linkage
- repeated review naming
- repeated operator/service alignment
## Tier 3 — soft expansion sources
Examples:
- Yelp nearby / also searched
- tagged mentions
- hashtag discovery
- reels/recommendation trails
- referral mentions
Tier 3 can expand search.
Tier 3 cannot finalize identity on its own.
# Rules for all agents
- Never promote a candidate solely because it was found.
- Never treat Yelp as final identity truth.
- Never treat a dead social link as a featured live profile.
- Never let soft-source expansion drift outside territory without explicit corroboration.
- Preserve ambiguity rather than forcing bad certainty.
- Prefer a true business anchor with no social over a guessed wrong social identity.
- Use source-independent validation logic whenever possible.
- Separate:
  - business truth
  - territory truth
  - channel/social truth
  - operator action state
# Preferred final output
Whenever possible, produce:
- normalized candidate summary
- evidence list
- territory result
- anchor result
- live result
- recommended final state
- confidence rating
- next action
# Good outcome examples
- confirmed live salon with verified IG and domain match
- real DORA/Maps business with no usable social yet
- candidate TikTok that is in-zone and likely real but needs review
- Yelp-derived alternate name rejected as out-of-territory
- dead IG candidate suppressed while anchor remains valid
# Bad outcome examples
- guessed IG promoted because the handle looked close
- nearby Yelp match treated as same business with no territory check
- dead or blocked link treated as live
- out-of-state result included because service category matched
- social profile chosen as truth without anchor support
