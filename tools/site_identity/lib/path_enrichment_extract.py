"""
Shallow, constrained fetches for path-based cluster member enrichment.
"""

from __future__ import annotations

import logging
import re
from typing import Any
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from bs4.element import Tag

from .anchor_directory_extract import extract_signals_from_soup, fetch_html
from .anchor_directory_normalize import classify_outbound_url, instagram_handle_from_url
from .path_enrichment_normalize import discovered_domain, normalize_discovered_name

LOG = logging.getLogger(__name__)

# Same-domain paths likely to be team / directory / profile listings (conservative).
TEAM_PATH_RE = re.compile(
    r"/(team|staff|our-?team|beautypros|members|artists|stylists|providers|professionals|about)(/|$)|/project/",
    re.I,
)

# Booking hosts we may follow one hop for staff/profile links (no global brute force).
_BOOKING_HOST_HINT = re.compile(
    r"(vagaro\.com|booksy\.com|square\.site|squareup\.com|glossgenius\.com|mindbody|fresha\.com|schedulicity\.com|acuityscheduling\.com)",
    re.I,
)


def page_title_or_h1(soup: BeautifulSoup) -> str | None:
    if soup.title and soup.title.string:
        t = str(soup.title.string).strip()
        if t:
            return t[:400]
    h1 = soup.find("h1")
    if isinstance(h1, Tag):
        tx = h1.get_text(" ", strip=True)
        if tx:
            return tx[:400]
    return None


def name_overlap_score(norm_member: str, raw_page: str | None) -> float:
    if not norm_member or not raw_page:
        return 0.0
    from rapidfuzz import fuzz  # noqa: PLC0415

    np = normalize_discovered_name(raw_page) or ""
    if not np:
        return 0.0
    return float(fuzz.token_set_ratio(norm_member, np)) / 100.0


def same_domain(a: str, b: str) -> bool:
    try:
        return (urlparse(a).netloc or "").lower() == (urlparse(b).netloc or "").lower()
    except Exception:
        return False


def abs_url(page_url: str, href: str | None) -> str | None:
    if not href or not str(href).strip():
        return None
    h = str(href).strip()
    if h.startswith(("#", "javascript:", "mailto:", "tel:", "data:")):
        return None
    try:
        u = urljoin(page_url, h)
        if urlparse(u).scheme not in ("http", "https"):
            return None
        return u
    except Exception:
        return None


def collect_same_domain_team_links(page_url: str, soup: BeautifulSoup, max_links: int) -> list[str]:
    """Deterministic sorted list of same-domain URLs whose paths look team/profile-like."""
    seen: set[str] = set()
    out: list[str] = []
    for a in soup.find_all("a", href=True):
        au = abs_url(page_url, a.get("href"))
        if not au or not same_domain(au, page_url):
            continue
        path = urlparse(au).path or ""
        if not TEAM_PATH_RE.search(path + "/"):
            continue
        if au not in seen:
            seen.add(au)
            out.append(au)
    out.sort()
    return out[:max_links]


def extract_linkedin_style_slugs(page_url: str, soup: BeautifulSoup, max_links: int) -> list[str]:
    """Optional: same-domain single-segment paths (e.g. /kim/) — very conservative."""
    seen: set[str] = set()
    out: list[str] = []
    base = urlparse(page_url).netloc
    for a in soup.find_all("a", href=True):
        au = abs_url(page_url, a.get("href"))
        if not au or not same_domain(au, page_url):
            continue
        path = (urlparse(au).path or "").strip("/")
        parts = [p for p in path.split("/") if p]
        if len(parts) != 1:
            continue
        seg = parts[0]
        if not re.match(r"^[a-z0-9][a-z0-9._-]{2,48}$", seg, re.I):
            continue
        skip = {
            "team",
            "staff",
            "about",
            "contact",
            "blog",
            "news",
            "privacy",
            "terms",
            "cart",
            "shop",
            "apply",
            "wp-admin",
        }
        if seg.lower() in skip:
            continue
        if au not in seen:
            seen.add(au)
            out.append(au)
    out.sort()
    return out[:max_links]


def signals_to_discovered(sig: dict[str, Any]) -> dict[str, Any]:
    return {
        "discovered_phone": sig.get("phone"),
        "discovered_website_url": sig.get("website_url"),
        "discovered_booking_url": sig.get("booking_url"),
        "discovered_booking_provider": sig.get("booking_provider"),
        "discovered_instagram_url": sig.get("instagram_url"),
        "discovered_instagram_handle": sig.get("instagram_handle"),
        "discovered_facebook_url": sig.get("facebook_url"),
        "discovered_tiktok_url": sig.get("tiktok_url"),
    }


def collect_linked_social_candidates(
    page_url: str,
    soup: BeautifulSoup,
    *,
    max_links: int,
) -> list[dict[str, Any]]:
    """Outbound IG/FB/tiktok/booking links as separate lightweight records."""
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for a in soup.find_all("a", href=True):
        au = abs_url(page_url, a.get("href"))
        if not au or au in seen:
            continue
        field, prov = classify_outbound_url(au)
        if field is None and not prov:
            continue
        seen.add(au)
        d: dict[str, Any] = {
            "discovered_url": au,
            "discovered_domain": discovered_domain(au),
        }
        if field == "instagram_url":
            d["discovered_instagram_url"] = au
            d["discovered_instagram_handle"] = instagram_handle_from_url(au)
        elif field == "facebook_url":
            d["discovered_facebook_url"] = au
        elif field == "tiktok_url":
            d["discovered_tiktok_url"] = au
        if field == "booking_url" or prov:
            d["discovered_booking_url"] = au
            d["discovered_booking_provider"] = prov
        rows.append(d)
        if len(rows) >= max_links:
            break
    return rows


def booking_page_staff_links(page_url: str, soup: BeautifulSoup, max_links: int) -> list[str]:
    """
    Same-host, same-merchant-prefix links only (avoid national marketing crawl).
    Example: seed https://www.vagaro.com/us02/foo/services → follow …/foo/… staff-like paths only.
    """
    seed = urlparse(page_url)
    seed_host = (seed.netloc or "").lower()
    parts = [p for p in (seed.path or "").split("/") if p]
    merchant_key = ""
    for p in parts:
        if p.lower() not in ("www", "us", "en-us", "pro", "users", "services", "book"):
            merchant_key = p
            break
    if not merchant_key and ".glossgenius.com" in seed_host:
        merchant_key = seed_host.split(".")[0]
    out: list[str] = []
    seen: set[str] = set()
    for a in soup.find_all("a", href=True):
        au = abs_url(page_url, a.get("href"))
        if not au:
            continue
        p_au = urlparse(au)
        host = (p_au.netloc or "").lower()
        if host != seed_host:
            continue
        path = (p_au.path or "").lower()
        if merchant_key:
            mk = merchant_key.lower()
            if mk not in path and mk not in host:
                continue
        if not any(x in path for x in ("/staff", "/team", "/provider", "/services", "/about")):
            continue
        if au not in seen:
            seen.add(au)
            out.append(au)
    out.sort()
    return out[:max_links]
