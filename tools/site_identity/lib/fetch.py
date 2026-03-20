"""
Shallow, deterministic HTTP fetch with robots.txt respect and page caps.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx

from . import config

logger = logging.getLogger(__name__)

_HTML_TYPES = ("text/html", "application/xhtml+xml")


@dataclass
class FetchResult:
    url_requested: str
    final_url: str
    status_code: int | None
    content_type: str | None
    html: str | None
    error: str | None
    elapsed_ms: float = 0.0


@dataclass
class DomainFetchBundle:
    """All pages fetched for one input row (same website)."""

    homepage_url: str
    pages: list[FetchResult] = field(default_factory=list)
    robots_respected: bool = True
    notes: list[str] = field(default_factory=list)


def _is_html(content_type: str | None) -> bool:
    if not content_type:
        return True  # assume html if missing
    ct = content_type.split(";")[0].strip().lower()
    return any(ct.startswith(t) for t in _HTML_TYPES)


def _robots_can_fetch(url: str, user_agent: str) -> bool:
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return False
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp = RobotFileParser()
    try:
        rp.set_url(robots_url)
        rp.read()
        return rp.can_fetch(user_agent, url)
    except Exception as e:
        logger.debug("robots.txt unreadable for %s: %s — allowing fetch", robots_url, e)
        return True


def fetch_url(
    client: httpx.Client,
    url: str,
    timeout: float,
    user_agent: str,
) -> FetchResult:
    t0 = time.perf_counter()
    try:
        if not _robots_can_fetch(url, user_agent):
            return FetchResult(
                url_requested=url,
                final_url=url,
                status_code=None,
                content_type=None,
                html=None,
                error="disallowed_by_robots.txt",
            )
        r = client.get(
            url,
            follow_redirects=True,
            timeout=timeout,
            headers={"User-Agent": user_agent, "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"},
        )
        elapsed = (time.perf_counter() - t0) * 1000
        final = str(r.url)
        ct = r.headers.get("content-type", "")
        if not _is_html(ct):
            return FetchResult(
                url_requested=url,
                final_url=final,
                status_code=r.status_code,
                content_type=ct,
                html=None,
                error=f"non_html:{ct}",
                elapsed_ms=elapsed,
            )
        text = r.text if r.status_code < 400 else None
        err = None if r.status_code < 400 else f"http_{r.status_code}"
        return FetchResult(
            url_requested=url,
            final_url=final,
            status_code=r.status_code,
            content_type=ct,
            html=text,
            error=err,
            elapsed_ms=elapsed,
        )
    except Exception as e:
        elapsed = (time.perf_counter() - t0) * 1000
        return FetchResult(
            url_requested=url,
            final_url=url,
            status_code=None,
            content_type=None,
            html=None,
            error=str(e)[:500],
            elapsed_ms=elapsed,
        )


def _collect_footer_href_same_domain(html: str, base_url: str, max_links: int = 12) -> list[str]:
    """
    Pull a few same-domain links from footer-ish regions (heuristic).
    """
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return []

    soup = BeautifulSoup(html, "lxml")
    out: list[str] = []
    parsed_base = urlparse(base_url)
    base_domain = parsed_base.netloc.lower()

    for footer in soup.find_all(["footer", "div"], class_=lambda c: c and isinstance(c, str) and "footer" in c.lower()):
        for a in footer.find_all("a", href=True):
            href = a["href"].strip()
            if href.startswith("#") or href.lower().startswith("javascript:"):
                continue
            abs_u = urljoin(base_url, href)
            p = urlparse(abs_u)
            if p.netloc.lower() == base_domain and p.scheme in ("http", "https"):
                out.append(abs_u.split("#")[0])
            if len(out) >= max_links:
                break
        if len(out) >= max_links:
            break

    # Dedupe preserve order
    seen: set[str] = set()
    uniq: list[str] = []
    for u in out:
        if u not in seen:
            seen.add(u)
            uniq.append(u)
    return uniq


def build_url_queue(final_home_url: str, homepage_html: str | None) -> list[str]:
    """
    Deterministic list of URLs: homepage + standard paths + same-domain footer links.
    Pass the post-redirect homepage URL.
    """
    parsed = urlparse(final_home_url)
    if not parsed.scheme or not parsed.netloc:
        return []
    origin = f"{parsed.scheme}://{parsed.netloc}"
    home = final_home_url.split("#")[0].rstrip("/") or origin

    queue: list[str] = [home]
    for path in config.IDENTITY_PATH_CANDIDATES:
        queue.append(urljoin(origin + "/", path.lstrip("/")))

    if homepage_html:
        for u in _collect_footer_href_same_domain(homepage_html, home):
            queue.append(u)

    seen: set[str] = set()
    uniq: list[str] = []
    for u in queue:
        u = u.split("#")[0].rstrip("/")
        if u not in seen:
            seen.add(u)
            uniq.append(u)
        if len(uniq) >= config.MAX_PAGES_PER_DOMAIN:
            break
    return uniq[: config.MAX_PAGES_PER_DOMAIN]


def fetch_domain_pages(
    seed_website_url: str,
    timeout: float | None = None,
    max_pages: int | None = None,
    verify_ssl: bool = True,
) -> DomainFetchBundle:
    """
    Fetch homepage first, then build queue from paths + footer (limited).
    """
    timeout = timeout or config.DEFAULT_TIMEOUT_SECONDS
    cap = max_pages or config.MAX_PAGES_PER_DOMAIN
    notes: list[str] = []
    parsed = urlparse(seed_website_url.strip())
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return DomainFetchBundle(
            homepage_url=seed_website_url,
            pages=[
                FetchResult(
                    seed_website_url,
                    seed_website_url,
                    None,
                    None,
                    None,
                    "invalid_url",
                )
            ],
            notes=["invalid_or_missing_website_url"],
        )

    seed = seed_website_url.strip()
    pages: list[FetchResult] = []

    limits = httpx.Limits(max_keepalive_connections=5, max_connections=10)
    with httpx.Client(limits=limits, http2=False, verify=verify_ssl) as client:
        first = fetch_url(client, seed, timeout, config.USER_AGENT)
        pages.append(first)

        final_home = (first.final_url or seed).split("#")[0]
        html = first.html if first.status_code and first.status_code < 400 else None
        queue = build_url_queue(final_home, html)
        first_norm = final_home.rstrip("/")

        for url in queue:
            if len(pages) >= cap:
                break
            u_norm = url.split("#")[0].rstrip("/")
            if u_norm == first_norm:
                continue
            fr = fetch_url(client, url, timeout, config.USER_AGENT)
            pages.append(fr)

    if len(pages) > cap:
        pages = pages[:cap]
        notes.append(f"trimmed_to_{cap}_pages")
    return DomainFetchBundle(homepage_url=seed, pages=pages, notes=notes)


def bundle_to_serializable(bundle: DomainFetchBundle) -> dict[str, Any]:
    return {
        "homepage_url": bundle.homepage_url,
        "robots_respected": bundle.robots_respected,
        "notes": bundle.notes,
        "pages": [
            {
                "url_requested": p.url_requested,
                "final_url": p.final_url,
                "status_code": p.status_code,
                "content_type": p.content_type,
                "error": p.error,
                "elapsed_ms": round(p.elapsed_ms, 2),
                "html_len": len(p.html) if p.html else 0,
            }
            for p in bundle.pages
        ],
    }
