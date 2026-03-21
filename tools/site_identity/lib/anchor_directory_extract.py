"""
Deterministic shallow fetch + HTML extraction for anchor brand directory pages.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from bs4.element import Tag

from .anchor_directory_normalize import merge_classified_into_row

LOG = logging.getLogger(__name__)

USER_AGENT = "vmb-mkt-anchor-directory-ingest/1.0 (+https://github.com/)"

_PHONE_RE = re.compile(
    r"(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}"
)


def fetch_html(
    client: httpx.Client,
    url: str,
    timeout: float,
) -> tuple[str | None, str | None]:
    """Returns (html, error_message)."""
    try:
        r = client.get(url, timeout=timeout, follow_redirects=True)
        if r.status_code >= 400:
            return None, f"HTTP {r.status_code}"
        ct = (r.headers.get("content-type") or "").lower()
        if "html" not in ct and "text" not in ct:
            return None, f"unexpected content-type: {ct!r}"
        return r.text, None
    except Exception as e:
        return None, str(e)


def _same_domain(a: str, b: str) -> bool:
    try:
        return (urlparse(a).netloc or "").lower() == (urlparse(b).netloc or "").lower()
    except Exception:
        return False


def _abs(page_url: str, href: str | None) -> str | None:
    if not href or not str(href).strip():
        return None
    h = str(href).strip()
    if h.startswith(("#", "javascript:", "mailto:", "tel:", "data:")):
        return None
    try:
        u = urljoin(page_url, h)
        p = urlparse(u)
        if p.scheme not in ("http", "https"):
            return None
        return u
    except Exception:
        return None


def extract_signals_from_soup(soup: BeautifulSoup, page_url: str) -> dict[str, Any]:
    """Collect outbound social/booking + tel + optional JSON-LD address."""
    row: dict[str, Any] = {
        "instagram_url": None,
        "instagram_handle": None,
        "booking_url": None,
        "booking_provider": None,
        "facebook_url": None,
        "tiktok_url": None,
        "phone": None,
        "website_url": None,
        "address_raw": None,
        "city": None,
        "state": None,
        "zip": None,
    }
    seen_website: set[str] = set()

    for a in soup.find_all("a", href=True):
        raw_h = a.get("href")
        abs_u = _abs(page_url, raw_h)
        if not abs_u:
            continue
        merge_classified_into_row(row, abs_u)

    for a in soup.find_all("a", href=True):
        h = (a.get("href") or "").strip()
        if h.lower().startswith("tel:"):
            if row.get("phone"):
                continue
            digits = re.sub(r"\D", "", h[4:])
            if len(digits) >= 10:
                m = _PHONE_RE.search(a.get_text() or "") or _PHONE_RE.search(h)
                row["phone"] = m.group(0).strip() if m else digits

    # First external http(s) link as personal website (not social/booking giants)
    skip_hosts = (
        "instagram.com",
        "facebook.com",
        "fb.com",
        "tiktok.com",
        "yelp.com",
        "linkedin.com",
        "twitter.com",
        "x.com",
        "pinterest.com",
        "google.com",
        "maps.google",
        "goo.gl",
        "modernsalonstudios.com",
        "solasalonstudios.com",
        "solanetwork.com",
    )
    try:
        base_host = (urlparse(page_url).netloc or "").lower()
    except Exception:
        base_host = ""
    for a in soup.find_all("a", href=True):
        abs_u = _abs(page_url, a.get("href"))
        if not abs_u:
            continue
        try:
            host = (urlparse(abs_u).netloc or "").lower()
        except Exception:
            continue
        if host == base_host:
            continue
        if any(x in host for x in skip_hosts):
            continue
        if host and abs_u not in seen_website:
            seen_website.add(abs_u)
            row["website_url"] = abs_u
            break

    for script in soup.find_all("script", type=re.compile(r"application/ld\+json", re.I)):
        raw = script.string or script.get_text() or ""
        if not raw.strip():
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if not isinstance(item, dict):
                continue
            addr = item.get("address")
            if isinstance(addr, dict):
                parts = [
                    addr.get("streetAddress"),
                    addr.get("addressLocality"),
                    addr.get("addressRegion"),
                    addr.get("postalCode"),
                ]
                line = ", ".join(str(p) for p in parts if p)
                if line and not row.get("address_raw"):
                    row["address_raw"] = line
                if addr.get("addressLocality") and not row.get("city"):
                    row["city"] = str(addr["addressLocality"]).strip()
                if addr.get("addressRegion") and not row.get("state"):
                    row["state"] = str(addr["addressRegion"]).strip()
                if addr.get("postalCode") and not row.get("zip"):
                    row["zip"] = str(addr["postalCode"]).strip()

    return row


def _listing_cluster_hints(soup: BeautifulSoup) -> list[str]:
    """Deterministic hints from filter/list UI (e.g. lines starting with ~)."""
    hints: list[str] = []
    for li in soup.find_all(["li", "option"]):
        t = li.get_text(" ", strip=True)
        if t.startswith("~") and len(t) < 120:
            hints.append(t.lstrip("~").strip())
    return sorted(set(hints))


def extract_modern_directory(
    client: httpx.Client,
    directory_url: str,
    *,
    timeout: float,
    max_profile_pages: int,
) -> list[dict[str, Any]]:
    """
    Modern SalonStudios: parse /beautypros/ style index for /project/... links, optionally fetch profiles.
    """
    html, err = fetch_html(client, directory_url, timeout)
    out: list[dict[str, Any]] = []
    if not html:
        LOG.warning("Modern fetch failed: %s — %s", directory_url, err)
        return out

    soup = BeautifulSoup(html, "lxml")
    hints = _listing_cluster_hints(soup)
    hint_blob = "; ".join(hints) if hints else None

    # /project/slug/ links (WordPress portfolio)
    seen: set[str] = set()
    pairs: list[tuple[str, str]] = []
    for a in soup.find_all("a", href=True):
        href = (a.get("href") or "").strip()
        if "/project/" not in href:
            continue
        abs_u = _abs(directory_url, href)
        if not abs_u or abs_u in seen:
            continue
        seen.add(abs_u)
        title = a.get_text(" ", strip=True)
        if not title and isinstance(a, Tag):
            img = a.find("img")
            if img and (img.get("alt") or "").strip():
                title = str(img.get("alt")).strip()
            if not title:
                ph = a.find_parent(["h1", "h2", "h3", "h4"])
                if isinstance(ph, Tag):
                    title = ph.get_text(" ", strip=True)
        if not title or len(title) < 2:
            continue
        pairs.append((title, abs_u))

    pairs.sort(key=lambda x: x[1])

    limit = len(pairs) if max_profile_pages <= 0 else min(len(pairs), max_profile_pages)
    for tenant_name_raw, profile_url in pairs[:limit]:
        notes: list[str] = ["modern:index_listing"]
        if hint_blob:
            notes.append(f"directory_filter_hints:{hint_blob[:500]}")

        row: dict[str, Any] = {
            "anchor_directory_url": directory_url,
            "anchor_location_name": None,
            "anchor_location_url": None,
            "anchor_cluster_hint": hint_blob,
            "tenant_name_raw": tenant_name_raw,
            "tenant_profile_url": profile_url,
            "service_category": None,
            "suite_number": None,
            "extraction_notes": notes,
        }
        ph_html, ph_err = fetch_html(client, profile_url, timeout)
        if ph_html:
            psoup = BeautifulSoup(ph_html, "lxml")
            sig = extract_signals_from_soup(psoup, profile_url)
            row.update({k: v for k, v in sig.items() if v is not None})
            row.setdefault("extraction_notes", []).append("modern:profile_page_fetched")
        else:
            row.setdefault("extraction_notes", []).append(f"modern:profile_fetch_failed:{ph_err}")

        out.append(row)

    return out


_SOLA_PATH_HINT = re.compile(
    r"/(locations?|salons?|find|our-?team|professionals?|stylists?|salon-[^/]+|the-[^/]+)(/|$)",
    re.I,
)


def extract_sola_directory(
    client: httpx.Client,
    directory_url: str,
    *,
    timeout: float,
    max_profile_pages: int,
    max_extra_pages: int,
) -> list[dict[str, Any]]:
    """
    Sola Salons: shallow crawl same-domain links matching path hints, then extract tenant-like blocks
    via Instagram / booking links and nearest headings (deterministic order).
    """
    html, err = fetch_html(client, directory_url, timeout)
    if not html:
        LOG.warning("Sola seed fetch failed: %s — %s", directory_url, err)
        return []

    soup = BeautifulSoup(html, "lxml")
    to_fetch: list[str] = [directory_url]
    seen_pages: set[str] = {directory_url}

    for a in soup.find_all("a", href=True):
        abs_u = _abs(directory_url, a.get("href"))
        if not abs_u or not _same_domain(abs_u, directory_url):
            continue
        path = urlparse(abs_u).path or ""
        if not _SOLA_PATH_HINT.search(path + "/"):
            continue
        if abs_u not in seen_pages:
            seen_pages.add(abs_u)
            to_fetch.append(abs_u)

    to_fetch = sorted(set(to_fetch))[: max(1, max_extra_pages)]

    all_rows: list[dict[str, Any]] = []
    page_idx = 0
    for page_url in to_fetch:
        page_idx += 1
        if page_url != directory_url:
            h2, e2 = fetch_html(client, page_url, timeout)
            if not h2:
                LOG.debug("Sola skip page %s: %s", page_url, e2)
                continue
            psoup = BeautifulSoup(h2, "lxml")
        else:
            psoup = soup

        # Strategy A: each instagram link → tenant block
        for a in psoup.find_all("a", href=True):
            href = (a.get("href") or "").strip()
            if "instagram.com" not in href.lower():
                continue
            abs_ig = _abs(page_url, href)
            if not abs_ig:
                continue
            name = _nearest_heading_text(a)
            if not name or len(name) < 2:
                continue
            row: dict[str, Any] = {
                "anchor_directory_url": directory_url,
                "anchor_location_name": None,
                "anchor_location_url": page_url if page_url != directory_url else None,
                "anchor_cluster_hint": None,
                "tenant_name_raw": name,
                "tenant_profile_url": page_url,
                "service_category": None,
                "suite_number": None,
                "instagram_url": abs_ig,
                "extraction_notes": [f"sola:instagram_link_page:{page_idx}"],
            }
            wrap = a.find_parent(["article", "section", "div", "li"])
            if isinstance(wrap, Tag):
                for la in wrap.find_all("a", href=True):
                    u = _abs(page_url, la.get("href"))
                    if u:
                        merge_classified_into_row(row, u)
            merge_classified_into_row(row, abs_ig)
            all_rows.append(row)

        # Strategy B: headings with tel / booking in section (no IG)
        for h in psoup.find_all(["h2", "h3", "h4"]):
            title = h.get_text(" ", strip=True)
            if not title or len(title) < 3 or len(title) > 180:
                continue
            sec = h.find_parent(["article", "section", "div"])
            if not isinstance(sec, Tag):
                continue
            blob = sec.get_text(" ", strip=True)
            if "instagram.com" in blob.lower():
                continue  # already covered
            sub: dict[str, Any] = {"tenant_name_raw": title, "extraction_notes": [f"sola:heading_section:{page_idx}"]}
            for la in sec.find_all("a", href=True):
                rawh = (la.get("href") or "").strip()
                if rawh.lower().startswith("tel:") and not sub.get("phone"):
                    digits = re.sub(r"\D", "", rawh[4:])
                    if len(digits) >= 10:
                        m = _PHONE_RE.search(la.get_text() or "") or _PHONE_RE.search(rawh)
                        sub["phone"] = m.group(0).strip() if m else digits
                    continue
                au = _abs(page_url, rawh)
                if au:
                    merge_classified_into_row(sub, au)
            if sub.get("booking_url") or sub.get("phone"):
                all_rows.append(
                    {
                        "anchor_directory_url": directory_url,
                        "anchor_location_url": page_url if page_url != directory_url else None,
                        "tenant_name_raw": title,
                        "tenant_profile_url": page_url,
                        "booking_url": sub.get("booking_url"),
                        "booking_provider": sub.get("booking_provider"),
                        "phone": sub.get("phone"),
                        "facebook_url": sub.get("facebook_url"),
                        "tiktok_url": sub.get("tiktok_url"),
                        "extraction_notes": sub["extraction_notes"],
                    }
                )

    # Dedupe by (tenant_name_norm-ish, profile_url, instagram_url)
    seen_k: set[tuple[str, str, str]] = set()
    deduped: list[dict[str, Any]] = []
    for r in sorted(all_rows, key=lambda x: (x.get("tenant_name_raw") or "", x.get("instagram_url") or "")):
        k = (
            (r.get("tenant_name_raw") or "").strip().lower(),
            (r.get("tenant_profile_url") or ""),
            (r.get("instagram_url") or ""),
        )
        if k in seen_k:
            continue
        seen_k.add(k)
        deduped.append(r)

    if max_profile_pages <= 0:
        return deduped
    return deduped[:max_profile_pages]


def _nearest_heading_text(start: Tag) -> str:
    """Walk previous siblings / parents for first h2–h4 text."""
    cur: Tag | None = start
    for _ in range(12):
        if cur is None:
            break
        prev = cur.find_previous(["h1", "h2", "h3", "h4"])
        if isinstance(prev, Tag):
            t = prev.get_text(" ", strip=True)
            if t and 2 < len(t) < 200:
                return t
        cur = cur.parent if isinstance(cur.parent, Tag) else None
    return ""
