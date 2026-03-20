"""
Extract identity signals from HTML: title, meta, JSON-LD, headings, footer, contacts.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urljoin, urlparse, urlunparse

from bs4 import BeautifulSoup
from bs4.element import Tag

from . import config
from .normalize_name import build_normalized_name, clean_visible_text

logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(
    r"(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}"
)

# Outbound-link classification only (no external fetches). Lower rank = higher priority when merging.
_PAGE_RANK_CONTACT = 0
_PAGE_RANK_HOME = 1
_PAGE_RANK_OTHER = 2
_ANCHOR_RANK_FOOTER = 0
_ANCHOR_RANK_NAV = 1
_ANCHOR_RANK_BODY = 2

# (pattern on netloc+path, provider id)
_BOOKING_RULES: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"vagaro\.com", re.I), "vagaro"),
    (re.compile(r"glossgenius\.com", re.I), "glossgenius"),
    (re.compile(r"squareup\.com|square\.site|square\.app", re.I), "square"),
    (re.compile(r"booksy\.com", re.I), "booksy"),
    (re.compile(r"fresha\.com", re.I), "fresha"),
    (re.compile(r"acuityscheduling\.com", re.I), "acuityscheduling"),
    (re.compile(r"schedulicity\.com", re.I), "schedulicity"),
    (re.compile(r"styleseat\.com", re.I), "styleseat"),
    (re.compile(r"joinblvd\.com|boulevard\.com", re.I), "boulevard"),
    (re.compile(r"mindbodyonline\.com|mindbody\.com", re.I), "mindbody"),
    (re.compile(r"phorest\.com", re.I), "phorest"),
)

_INSTAGRAM_SKIP_SEGS = frozenset(
    {"p", "reel", "reels", "stories", "explore", "accounts", "tv", "direct", "about"}
)


@dataclass
class NameCandidate:
    source_field: str
    page_url: str
    raw_text: str
    normalized_full: str
    normalized_reduced: str
    confidence_hint: float
    priority: int


@dataclass
class ExtractedIdentity:
    title: str | None
    og_site_name: str | None
    application_name: str | None
    h1_texts: list[str]
    nav_brand_guess: str | None
    footer_text_sample: str | None
    jsonld_names: list[str]
    name_candidates: list[NameCandidate]
    phones: list[str]
    emails: list[str]
    address_snippets: list[str]
    booking_hints: list[str]
    social_links: list[str]
    canonical_url: str | None
    notes: list[str] = field(default_factory=list)
    # (field_key, absolute_url, booking_provider or None, sort_key tuple)
    social_booking_discoveries: list[tuple[str, str, str | None, tuple[int, int, int]]] = field(
        default_factory=list
    )


@dataclass
class SocialBookingFlat:
    """Projected top-level outbound-link signals (merged across fetched pages)."""

    instagram_url: str | None = None
    instagram_handle: str | None = None
    facebook_url: str | None = None
    tiktok_url: str | None = None
    yelp_url: str | None = None
    linktree_url: str | None = None
    booking_url: str | None = None
    booking_provider: str | None = None


def _strip_url_noise(url: str) -> str:
    try:
        p = urlparse(url)
        clean = urlunparse(
            (p.scheme, p.netloc.lower(), (p.path or "").rstrip("/") or "/", "", "", "")
        )
        return clean
    except Exception:
        return url


def _abs_href(page_url: str, href: str) -> str | None:
    h = (href or "").strip()
    if not h or h.startswith("#"):
        return None
    low = h.lower()
    if low.startswith(("mailto:", "tel:", "javascript:", "data:", "blob:")):
        return None
    try:
        abs_u = urljoin(page_url, h)
        pr = urlparse(abs_u)
        if pr.scheme not in ("http", "https"):
            return None
        return abs_u
    except Exception:
        return None


def _instagram_handle_from_url(url: str) -> str | None:
    try:
        p = urlparse(url.lower())
    except Exception:
        return None
    if "instagram.com" not in (p.netloc or ""):
        return None
    parts = [x for x in (p.path or "").split("/") if x]
    if not parts:
        return None
    seg = parts[0]
    if seg in _INSTAGRAM_SKIP_SEGS:
        return None
    if re.match(r"^[a-z0-9._]{1,30}$", seg, re.I):
        return seg.strip(".")
    return None


def _classify_outbound_url(url: str) -> tuple[str | None, str | None]:
    """
    Returns (field_name, booking_provider).
    field_name is one of: instagram_url, facebook_url, tiktok_url, yelp_url, linktree_url, booking_url
    """
    try:
        p = urlparse(url.lower())
    except Exception:
        return None, None
    host = p.netloc or ""
    path = p.path or ""

    if "instagram.com" in host:
        return "instagram_url", None
    if "facebook.com" in host or "fb.com" in host:
        return "facebook_url", None
    if "tiktok.com" in host:
        return "tiktok_url", None
    if "yelp.com" in host:
        return "yelp_url", None
    if "linktr.ee" in host or "linktree.com" in host:
        return "linktree_url", None

    joined = f"{host}{path}"
    for pat, prov in _BOOKING_RULES:
        if pat.search(joined):
            return "booking_url", prov
    return None, None


def _anchor_container_rank(tag: Tag) -> int:
    """0 footer, 1 nav/header, 2 body."""
    cur: Tag | None = tag
    depth = 0
    while cur and depth < 40:
        name = (cur.name or "").lower()
        if name == "footer":
            return _ANCHOR_RANK_FOOTER
        if name in ("nav", "header"):
            return _ANCHOR_RANK_NAV
        cur = cur.parent if isinstance(cur.parent, Tag) else None
        depth += 1
    return _ANCHOR_RANK_BODY


def _page_rank_from_url(page_url: str, page_index: int) -> int:
    try:
        path = (urlparse(page_url).path or "").lower()
    except Exception:
        path = ""
    if re.search(r"/(contact|contact-us|contactus|reach|locations?)(/|$)", path):
        return _PAGE_RANK_CONTACT
    if page_index == 0:
        return _PAGE_RANK_HOME
    return _PAGE_RANK_OTHER


def _merge_sort_key(page_rank: int, anchor_rank: int, page_index: int) -> tuple[int, int, int]:
    return (page_rank, anchor_rank, page_index)


def extract_social_booking_discoveries(
    soup: BeautifulSoup, page_url: str, page_index: int
) -> list[tuple[str, str, str | None, tuple[int, int, int]]]:
    """Collect classified outbound links with deterministic merge keys."""
    pr = _page_rank_from_url(page_url, page_index)
    out: list[tuple[str, str, str | None, tuple[int, int, int]]] = []
    seen_pair: set[tuple[str, str]] = set()

    for a in soup.find_all("a", href=True):
        raw_h = a.get("href")
        if not isinstance(raw_h, str):
            continue
        abs_u = _abs_href(page_url, raw_h)
        if not abs_u:
            continue
        field, bprov = _classify_outbound_url(abs_u)
        if not field:
            continue
        ar = _anchor_container_rank(a)
        key = (field, abs_u)
        if key in seen_pair:
            continue
        seen_pair.add(key)
        sk = _merge_sort_key(pr, ar, page_index)
        out.append((field, _strip_url_noise(abs_u), bprov, sk))

    return out


def merge_social_booking_flat(
    discoveries: list[tuple[str, str, str | None, tuple[int, int, int]]],
) -> SocialBookingFlat:
    """First winning row per field by sort_key (contact/footer wins over generic body)."""
    by_field: dict[str, list[tuple[str, str | None, tuple[int, int, int]]]] = {}
    for field, url, bprov, sk in discoveries:
        by_field.setdefault(field, []).append((url, bprov, sk))

    flat = SocialBookingFlat()
    order = (
        "instagram_url",
        "facebook_url",
        "tiktok_url",
        "yelp_url",
        "linktree_url",
        "booking_url",
    )
    for f in order:
        items = by_field.get(f)
        if not items:
            continue
        items_sorted = sorted(items, key=lambda x: (x[2], len(x[0])))
        best_url, best_prov, _ = items_sorted[0]
        if f == "instagram_url":
            flat.instagram_url = best_url
            flat.instagram_handle = _instagram_handle_from_url(best_url)
        elif f == "facebook_url":
            flat.facebook_url = best_url
        elif f == "tiktok_url":
            flat.tiktok_url = best_url
        elif f == "yelp_url":
            flat.yelp_url = best_url
        elif f == "linktree_url":
            flat.linktree_url = best_url
        elif f == "booking_url":
            flat.booking_url = best_url
            flat.booking_provider = best_prov

    return flat


def _priority_for_source(source_field: str) -> int:
    if source_field.startswith("jsonld"):
        return config.PRIORITY_JSON_LD
    if source_field == "og:site_name":
        return config.PRIORITY_OG_SITE
    if source_field == "application-name":
        return config.PRIORITY_APP_NAME
    if source_field == "nav_brand":
        return config.PRIORITY_NAV_BRAND
    if source_field == "title":
        return config.PRIORITY_TITLE
    if source_field == "h1":
        return config.PRIORITY_H1
    if source_field.startswith("footer"):
        return config.PRIORITY_FOOTER
    return config.PRIORITY_BODY


def _confidence_for_source(source_field: str) -> float:
    base = {
        "jsonld": 0.95,
        "og:site_name": 0.9,
        "application-name": 0.88,
        "nav_brand": 0.75,
        "title": 0.7,
        "h1": 0.65,
        "footer": 0.55,
        "body_snippet": 0.4,
    }
    for k, v in base.items():
        if source_field.startswith(k):
            return v
    return 0.45


def _parse_jsonld_scripts(soup: BeautifulSoup) -> list[str]:
    names: list[str] = []
    for script in soup.find_all("script", type=lambda t: t and "ld+json" in t.lower()):
        raw = script.string or script.get_text() or ""
        raw = raw.strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue

        def walk(o: Any, depth: int = 0) -> None:
            if depth > 14:
                return
            if isinstance(o, dict):
                t = o.get("@type")
                types = t if isinstance(t, list) else ([t] if t else [])
                type_str = [str(x).lower() for x in types if x]
                interesting = any(
                    x in type_str
                    for x in (
                        "localbusiness",
                        "organization",
                        "beautysalon",
                        "hairsalon",
                        "nailsalon",
                        "healthandbeautybusiness",
                    )
                )
                name = o.get("name")
                if isinstance(name, str) and name.strip():
                    if interesting or "business" in str(type_str):
                        names.append(name.strip())
                for v in o.values():
                    walk(v, depth + 1)
            elif isinstance(o, list):
                for it in o:
                    walk(it, depth + 1)

        walk(data)
    return names


def _nav_brand_guess(soup: BeautifulSoup) -> str | None:
    header = soup.find(["header", "nav"])
    if not header:
        return None
    # First short link text or image alt in header
    for a in header.find_all("a", href=True, limit=8):
        t = clean_visible_text(a.get_text(), 80)
        if 2 <= len(t) <= 60 and not t.lower().startswith("http"):
            return t
    for img in header.find_all("img", alt=True, limit=5):
        alt = clean_visible_text(img.get("alt", ""), 80)
        if 2 <= len(alt) <= 80:
            return alt
    return None


def _footer_sample(soup: BeautifulSoup) -> str | None:
    foot = soup.find("footer")
    if not foot:
        return None
    return clean_visible_text(foot.get_text(), 600)


def _strip_title_spam(title: str) -> str:
    """
    Reduce 'Home | Welcome | Book' style spam — take longest segment that looks like a name.
    """
    if not title:
        return ""
    parts = re.split(r"\s*[|\u2013\u2014\-/]+\s*", title)
    parts = [p.strip() for p in parts if p.strip()]
    if not parts:
        return clean_visible_text(title, 200)
    # Prefer segment that doesn't look like generic
    bad = re.compile(r"^(home|welcome|book|online|salon|spa|nails?)\b", re.I)
    scored = [(len(p), p) for p in parts if not bad.match(p)]
    if scored:
        scored.sort(reverse=True)
        return clean_visible_text(scored[0][1], 200)
    return clean_visible_text(parts[0], 200)


def extract_from_html(html: str, page_url: str, page_index: int = 0) -> ExtractedIdentity:
    soup = BeautifulSoup(html, "lxml")
    title = None
    if soup.title and soup.title.string:
        title = _strip_title_spam(soup.title.string)

    og = soup.find("meta", property="og:site_name")
    og_site = og.get("content") if og and og.get("content") else None
    app = soup.find("meta", attrs={"name": "application-name"})
    application_name = app.get("content") if app and app.get("content") else None
    link_can = soup.find("link", rel="canonical")
    canonical = link_can.get("href") if link_can and link_can.get("href") else None

    h1s: list[str] = []
    for h in soup.find_all("h1", limit=5):
        t = clean_visible_text(h.get_text(), 300)
        if t:
            h1s.append(t)

    nav_brand = _nav_brand_guess(soup)
    footer = _footer_sample(soup)

    jsonld_names = _parse_jsonld_scripts(soup)

    phones: list[str] = []
    emails: list[str] = []
    addr_bits: list[str] = []
    text_blob = soup.get_text(" ", strip=False) if soup else ""
    for m in PHONE_RE.findall(text_blob):
        p = clean_visible_text(m, 40)
        if len(re.sub(r"\D", "", p)) >= 10:
            phones.append(p)
    for m in EMAIL_RE.findall(text_blob):
        emails.append(m.lower())
    # crude address: line with digit + street-like word
    addr_line = re.compile(
        r"\d{2,6}\s+[A-Za-z0-9\s]+(?:street|st\.|avenue|ave|road|rd|blvd|drive|dr|lane|ln|way)\b",
        re.I,
    )
    for m in addr_line.findall(text_blob[:8000]):
        addr_bits.append(clean_visible_text(m, 120))

    phones = list(dict.fromkeys(phones))[:20]
    emails = list(dict.fromkeys(emails))[:20]
    addr_bits = list(dict.fromkeys(addr_bits))[:15]

    booking_hints: list[str] = []
    for kw in ("booksy", "vagaro", "mindbody", "squareup", "square.site", "acuity", "zenoti"):
        if kw in text_blob.lower():
            booking_hints.append(kw)

    sb_disc = extract_social_booking_discoveries(soup, page_url, page_index)
    social_links: list[str] = []
    for field, url, _bprov, _sk in sb_disc:
        if field in ("instagram_url", "facebook_url", "tiktok_url", "yelp_url", "linktree_url"):
            social_links.append(url)
    social_links = list(dict.fromkeys(social_links))[:25]

    candidates: list[NameCandidate] = []

    def add_candidate(source_field: str, raw: str | None) -> None:
        if not raw or len(raw.strip()) < 2:
            return
        raw = clean_visible_text(raw, 400)
        nn = build_normalized_name(raw)
        if len(nn.full_compare) < 2:
            return
        pr = _priority_for_source(source_field)
        candidates.append(
            NameCandidate(
                source_field=source_field,
                page_url=page_url,
                raw_text=raw,
                normalized_full=nn.full_compare,
                normalized_reduced=nn.reduced_compare,
                confidence_hint=_confidence_for_source(source_field),
                priority=pr,
            )
        )

    for i, n in enumerate(jsonld_names):
        add_candidate(f"jsonld:{i}", n)
    add_candidate("og:site_name", og_site)
    add_candidate("application-name", application_name)
    add_candidate("nav_brand", nav_brand)
    add_candidate("title", title)
    for i, h in enumerate(h1s):
        add_candidate(f"h1:{i}", h)
    if footer:
        add_candidate("footer", footer[:500])

    # Dedupe by (normalized_full, source_field) keeping highest confidence
    uniq: dict[tuple[str, str], NameCandidate] = {}
    for c in sorted(candidates, key=lambda x: (-x.confidence_hint, x.priority)):
        key = (c.normalized_full, c.source_field)
        if key not in uniq:
            uniq[key] = c
    merged = list(uniq.values())
    merged.sort(key=lambda x: (x.priority, -x.confidence_hint))

    notes: list[str] = []
    if not merged:
        notes.append("no_name_candidates_extracted")

    return ExtractedIdentity(
        title=title,
        og_site_name=og_site,
        application_name=application_name,
        h1_texts=h1s,
        nav_brand_guess=nav_brand,
        footer_text_sample=footer[:400] if footer else None,
        jsonld_names=jsonld_names,
        name_candidates=merged,
        phones=phones,
        emails=emails,
        address_snippets=addr_bits,
        booking_hints=booking_hints,
        social_links=social_links,
        canonical_url=canonical,
        notes=notes,
        social_booking_discoveries=sb_disc,
    )


def aggregate_from_pages(
    pages: list[tuple[str, str | None]],
) -> tuple[
    list[NameCandidate],
    list[str],
    list[str],
    list[str],
    list[str],
    list[str],
    SocialBookingFlat,
]:
    """
    Single pass per page: name candidates plus phones, emails, addresses, booking hints, socials.
    pages: (final_url, html).
    """
    all_c: list[NameCandidate] = []
    phones: list[str] = []
    emails: list[str] = []
    addrs: list[str] = []
    booking: list[str] = []
    social: list[str] = []
    all_sb: list[tuple[str, str, str | None, tuple[int, int, int]]] = []
    for pi, (page_url, html) in enumerate(pages):
        if not html:
            continue
        try:
            ex = extract_from_html(html, page_url, page_index=pi)
            all_c.extend(ex.name_candidates)
            phones.extend(ex.phones)
            emails.extend(ex.emails)
            addrs.extend(ex.address_snippets)
            booking.extend(ex.booking_hints)
            social.extend(ex.social_links)
            all_sb.extend(ex.social_booking_discoveries)
        except Exception as e:
            logger.debug("extract failed %s: %s", page_url, e)

    best: dict[tuple[str, str], NameCandidate] = {}
    for c in sorted(all_c, key=lambda x: (-x.confidence_hint, x.priority)):
        k = (c.normalized_full, c.source_field)
        if k not in best:
            best[k] = c
    merged = list(best.values())
    merged.sort(key=lambda x: (x.priority, -x.confidence_hint, -len(x.raw_text)))

    def dedup(xs: list[str]) -> list[str]:
        return list(dict.fromkeys(xs))[:50]

    sb_flat = merge_social_booking_flat(all_sb)
    return merged, dedup(phones), dedup(emails), dedup(addrs), dedup(booking), dedup(social), sb_flat


def merge_extractions(pages: list[tuple[str, str | None]]) -> list[NameCandidate]:
    """Backward-compatible: candidates only."""
    return aggregate_from_pages(pages)[0]


def best_site_name(candidates: list[NameCandidate]) -> tuple[str | None, str | None]:
    if not candidates:
        return None, None
    top = sorted(
        candidates,
        key=lambda x: (-x.confidence_hint, x.priority, -len(x.normalized_full)),
    )[0]
    return top.raw_text, top.normalized_full


def domain_from_url(url: str) -> str:
    try:
        return urlparse(url).netloc.lower()
    except Exception:
        return ""
