"""
Normalization for path-enrichment candidates (reuse anchor_directory rules).
"""

from __future__ import annotations

from urllib.parse import urlparse

from .anchor_directory_normalize import (
    classify_outbound_url,
    instagram_handle_from_url,
    normalize_tenant_name_norm,
)


def discovered_domain(url: str | None) -> str | None:
    if not url or not str(url).strip():
        return None
    try:
        return (urlparse(str(url).strip()).netloc or None) or None
    except Exception:
        return None


def normalize_discovered_name(raw: str | None) -> str | None:
    return normalize_tenant_name_norm(raw)
