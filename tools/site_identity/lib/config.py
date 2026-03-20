"""
Central configuration: match thresholds, crawl limits, normalization noise words.
Tune thresholds here only.
"""

from __future__ import annotations

# --- Crawl / fetch ---
MAX_PAGES_PER_DOMAIN = 8
DEFAULT_TIMEOUT_SECONDS = 12.0
MAX_RETRIES = 2
USER_AGENT = (
    "VMB-SiteIdentityBot/1.0 (+https://github.com/blk911/vmb-mkt; identity resolution; polite)"
)

# Standard paths tried after homepage (deterministic order).
IDENTITY_PATH_CANDIDATES: tuple[str, ...] = (
    "/about",
    "/about-us",
    "/our-story",
    "/contact",
    "/contact-us",
    "/services",
    "/appointments",
    "/book",
    "/booking",
    "/locations",
    "/location",
)

# --- Match labels (string values in output) ---
LABEL_STRONG = "strong_match"
LABEL_PROBABLE = "probable_match"
LABEL_WEAK = "weak_match"
LABEL_AMBIGUOUS = "ambiguous"
LABEL_NO_MATCH = "no_match"

# Composite score is 0..1. Thresholds (inclusive lower bound for that tier).
THRESHOLD_STRONG = 0.85
THRESHOLD_PROBABLE = 0.70
THRESHOLD_WEAK = 0.55
# Strong match also requires at least one corroborating signal (phone or address overlap).
STRONG_REQUIRES_CORROBORATION = True

# If top two (name, score) pairs are within this gap, mark ambiguous.
AMBIGUITY_SCORE_GAP = 0.04
# If two different reference names (google vs dora) both "win" with similar scores → ambiguous
AMBIGUITY_MULTI_REF_GAP = 0.06

# --- Scoring weights (composite 0..1) ---
WEIGHT_NAME_BEST = 0.72
WEIGHT_PHONE_BONUS = 0.14
WEIGHT_ADDRESS_BONUS = 0.14
# Cap bonuses so name still dominates
MAX_PHONE_BONUS = 1.0
MAX_ADDRESS_BONUS = 1.0

# --- Source priority for website name candidates (lower = better). ---
PRIORITY_JSON_LD = 1
PRIORITY_OG_SITE = 2
PRIORITY_APP_NAME = 2
PRIORITY_NAV_BRAND = 3
PRIORITY_TITLE = 4
PRIORITY_H1 = 5
PRIORITY_FOOTER = 6
PRIORITY_BODY = 7

# --- Normalization: optional suffix / noise tokens removed in "reduced" form only ---
NAME_NOISE_WORDS: frozenset[str] = frozenset(
    {
        "llc",
        "inc",
        "ltd",
        "co",
        "company",
        "studio",
        "studios",
        "salon",
        "salons",
        "spa",
        "nails",
        "nail",
        "beauty",
        "bar",
        "shop",
        "suites",
        "suite",
        "the",
        "d/b/a",
        "dba",
    }
)
