"""
Gray pin resolver: high-probability search queries + scoring for identity recovery.

Maps UI "gray" = no anchor, no IG/booking presence, no path enrichment (see `member_is_gray_pin`).
Does not call search APIs here — emits queries for manual / future Serp integration; scoring is for ranked results.
"""

from __future__ import annotations

import re
from typing import Any, Literal

from rapidfuzz import fuzz

from .cluster_resolver import haversine_meters, parse_float

_MILES_TO_M = 1609.344
_GEO_MATCH_MI = 0.1
_SPACE_RE = re.compile(r"\s+")


def member_is_gray_pin(row: dict[str, Any]) -> bool:
    """
    True when the business matches "fallback" map semantics:
    not anchor, no site_identity IG/booking signals, no path enrichment match.
    """
    if row.get("is_anchor") is True:
        return False
    ig = (str(row.get("instagram_url") or "").strip()) or (str(row.get("instagram_handle") or "").strip())
    bp = str(row.get("booking_provider") or "").strip()
    bu = str(row.get("booking_url") or "").strip()
    if ig or bp or bu:
        return False
    if row.get("path_enrichment_matched") is True:
        return False
    return True


def _clean(s: str) -> str:
    return _SPACE_RE.sub(" ", (s or "").strip())


def build_gray_resolution_queries(
    name: str,
    address: str,
    city: str,
    state: str,
    category: str,
) -> list[str]:
    """
    Build search-query strings for recovering IG / booking / identity for low-signal members.
    Order: exact geo → category → address-first → platform probes → partial name.
    """
    name = _clean(name)
    address = _clean(address)
    city = _clean(city)
    state = _clean(state)
    category = _clean(category) or "salon"

    queries: list[str] = []

    if name and city and state:
        queries.append(f'"{name}" {city} {state}')
    if name and address:
        queries.append(f'"{name}" {address}')
    if name and city:
        queries.append(f"{name} {category} {city}")
        queries.append(f"{name} salon {city}")
        queries.append(f"{name} spa {city}")
    if address:
        queries.append(f"{address} {category}")
        queries.append(f"{address} salon")
        queries.append(f"{address} spa")

    if name:
        queries.append(f'"{name}" site:instagram.com')
        queries.append(f'"{name}" site:vagaro.com')
        queries.append(f'"{name}" site:glossgenius.com')
        queries.append(f'"{name}" site:booksy.com')

    tokens = name.split()
    if len(tokens) > 1:
        partial = " ".join(tokens[:2])
        queries.append(f"{partial} {city} salon")
        queries.append(f"{partial} {city} instagram")

    # De-dupe while preserving order
    seen: set[str] = set()
    out: list[str] = []
    for q in queries:
        q = _clean(q)
        if not q or q in seen:
            continue
        seen.add(q)
        out.append(q)
    return out


def build_address_instagram_probe(address: str, city: str = "", state: str = "") -> str:
    """
    High-alpha: address-first Instagram discovery (tagged posts / geo-tagged accounts).
    Example: "1512 Larimer St Denver" instagram
    """
    parts = [_clean(address)]
    if city:
        parts.append(_clean(city))
    if state:
        parts.append(_clean(state))
    base = _clean(" ".join(p for p in parts if p))
    if not base:
        return "instagram"
    return f"{base} instagram"


def name_similarity_ratio(a: str, b: str) -> float:
    """0..1 similarity for business names."""
    a, b = _clean(a), _clean(b)
    if not a or not b:
        return 0.0
    return fuzz.token_set_ratio(a, b) / 100.0


def addresses_likely_match(addr_a: str, addr_b: str, *, min_ratio: float = 0.85) -> bool:
    """Loose address match: token_set ratio or containment of normalized street number + street."""
    addr_a, addr_b = _clean(addr_a).lower(), _clean(addr_b).lower()
    if not addr_a or not addr_b:
        return False
    if addr_a == addr_b:
        return True
    r = fuzz.token_set_ratio(addr_a, addr_b) / 100.0
    if r >= min_ratio:
        return True
    # Same building: share a significant token (e.g. suite numbers are weak; street numbers help)
    toks_a = set(addr_a.split())
    toks_b = set(addr_b.split())
    digits_a = {t for t in toks_a if t.isdigit() and len(t) >= 3}
    digits_b = {t for t in toks_b if t.isdigit() and len(t) >= 3}
    if digits_a & digits_b:
        return True
    return False


def same_geo_within_miles(
    lat1: float | None,
    lon1: float | None,
    lat2: float | None,
    lon2: float | None,
    max_miles: float = _GEO_MATCH_MI,
) -> bool:
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return False
    m = haversine_meters(lat1, lon1, lat2, lon2)
    return (m / _MILES_TO_M) <= max_miles


def compute_gray_resolution_score(
    *,
    name_similarity: float,
    address_match: bool,
    same_geo_within_0_1_mi: bool,
    ig_or_booking_found: bool,
    same_building_suite: bool,
) -> int:
    """
    Additive score (max 13). Thresholds: >=7 AUTO, 4–6 REVIEW, <4 discard.
    """
    score = 0
    if name_similarity > 0.8:
        score += 3
    if address_match:
        score += 3
    if same_geo_within_0_1_mi:
        score += 2
    if ig_or_booking_found:
        score += 3
    if same_building_suite:
        score += 2
    return score


def classify_resolution_tier(score: int) -> Literal["auto", "review", "discard"]:
    if score >= 7:
        return "auto"
    if score >= 4:
        return "review"
    return "discard"


def score_candidate_against_member(
    member: dict[str, Any],
    candidate: dict[str, Any],
) -> tuple[int, dict[str, Any]]:
    """
    Score a single search/identity candidate row against a market member.

    `candidate` may include:
      - title, snippet, or discovered_name (str)
      - address, formatted_address (str)
      - lat, lng (float)
      - instagram_url, booking_url (non-empty => signals)
      - suite_match or same_suite (bool)
    """
    m_name = str(member.get("name") or "")
    m_addr = " ".join(
        [
            str(member.get("address") or ""),
            str(member.get("city") or ""),
            str(member.get("state") or ""),
            str(member.get("zip") or ""),
        ]
    )
    m_lat = parse_float(member.get("lat"))
    m_lon = parse_float(member.get("lon"))

    c_name = str(
        candidate.get("discovered_name")
        or candidate.get("title")
        or candidate.get("name")
        or ""
    )
    c_addr = str(candidate.get("formatted_address") or candidate.get("address") or "")

    ns = name_similarity_ratio(m_name, c_name) if c_name else 0.0
    addr_ok = addresses_likely_match(m_addr, c_addr) if c_addr else False

    c_lat = parse_float(candidate.get("lat"))
    c_lon = parse_float(candidate.get("lng") if candidate.get("lng") is not None else candidate.get("lon"))

    geo_ok = False
    if m_lat is not None and m_lon is not None and c_lat is not None and c_lon is not None:
        geo_ok = same_geo_within_miles(m_lat, m_lon, c_lat, c_lon)

    ig = str(candidate.get("instagram_url") or "").strip()
    book = str(candidate.get("booking_url") or candidate.get("booking_provider") or "").strip()
    ig_book = bool(ig or book)

    suite = bool(candidate.get("suite_match") or candidate.get("same_building_suite") or candidate.get("same_suite"))

    total = compute_gray_resolution_score(
        name_similarity=ns,
        address_match=addr_ok,
        same_geo_within_0_1_mi=geo_ok,
        ig_or_booking_found=ig_book,
        same_building_suite=suite,
    )

    detail = {
        "name_similarity": round(ns, 4),
        "address_match": addr_ok,
        "same_geo_within_0_1_mi": geo_ok,
        "ig_or_booking_found": ig_book,
        "same_building_suite": suite,
        "tier": classify_resolution_tier(total),
    }
    return total, detail
