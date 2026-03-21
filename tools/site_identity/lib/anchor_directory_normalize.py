"""
Normalize anchor-directory tenant rows (deterministic; no invented facts).
Booking-provider rules mirror `extract_identity._BOOKING_RULES` + classification behavior.
"""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

from .normalize_name import build_normalized_name

# Mirror tools/site_identity/lib/extract_identity.py _BOOKING_RULES (+ instagram/facebook/tiktok classification)
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

_INSTAGRAM_SKIP = frozenset({"p", "reel", "reels", "stories", "explore", "accounts", "tv", "direct", "about"})

def _as_note_list(v: Any) -> list[str]:
    if v is None:
        return []
    if isinstance(v, str):
        return [v] if v.strip() else []
    if isinstance(v, list):
        return [str(x) for x in v if x is not None and str(x).strip()]
    return [str(v)]


CANONICAL_ANCHOR = {
    "modern": "Modern SalonStudios",
    "sola": "Sola Salons",
}


def canonical_anchor_brand(brand_key: str) -> str:
    k = (brand_key or "").strip().lower()
    return CANONICAL_ANCHOR.get(k, brand_key or "")


def normalize_tenant_name_norm(raw: str | None) -> str | None:
    if not raw or not str(raw).strip():
        return None
    return build_normalized_name(str(raw).strip()).full_compare


def instagram_handle_from_url(url: str | None) -> str | None:
    if not url:
        return None
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
    if seg in _INSTAGRAM_SKIP:
        return None
    if re.match(r"^[a-z0-9._]{1,30}$", seg, re.I):
        return seg.strip(".")
    return None


def classify_outbound_url(url: str) -> tuple[str | None, str | None]:
    """
    Returns (field_name, booking_provider).
    field_name: instagram_url | facebook_url | tiktok_url | booking_url | None
    """
    try:
        p = urlparse(url.lower())
    except Exception:
        return None, None
    host = p.netloc or ""
    path = p.path or ""
    joined = f"{host}{path}"

    if "instagram.com" in host:
        return "instagram_url", None
    if "facebook.com" in host or "fb.com" in host:
        return "facebook_url", None
    if "tiktok.com" in host:
        return "tiktok_url", None

    for pat, prov in _BOOKING_RULES:
        if pat.search(joined):
            return "booking_url", prov
    return None, None


def merge_classified_into_row(target: dict[str, Any], url: str) -> None:
    """Merge first useful classification per field (deterministic: do not overwrite non-empty)."""
    if not url or not str(url).strip():
        return
    field, prov = classify_outbound_url(url)
    if not field:
        return
    if field == "instagram_url" and not target.get("instagram_url"):
        target["instagram_url"] = url
        ih = instagram_handle_from_url(url)
        if ih and not target.get("instagram_handle"):
            target["instagram_handle"] = ih
    elif field == "facebook_url" and not target.get("facebook_url"):
        target["facebook_url"] = url
    elif field == "tiktok_url" and not target.get("tiktok_url"):
        target["tiktok_url"] = url
    elif field == "booking_url" and not target.get("booking_url"):
        target["booking_url"] = url
        if prov and not target.get("booking_provider"):
            target["booking_provider"] = prov


def normalize_directory_row(
    raw: dict[str, Any],
    *,
    anchor_brand_key: str,
    source_type: str = "anchor_directory",
    source_confidence: str = "high",
) -> dict[str, Any]:
    """Ensure all schema keys exist; normalize name + handle; do not invent."""
    brand = canonical_anchor_brand(anchor_brand_key)
    tn = raw.get("tenant_name_raw")
    out: dict[str, Any] = {
        "anchor_brand": brand or None,
        "anchor_location_name": raw.get("anchor_location_name"),
        "anchor_location_url": raw.get("anchor_location_url"),
        "anchor_directory_url": raw.get("anchor_directory_url"),
        "anchor_cluster_hint": raw.get("anchor_cluster_hint"),
        "tenant_name_raw": tn if isinstance(tn, str) else (str(tn) if tn is not None else None),
        "tenant_name_norm": normalize_tenant_name_norm(str(tn).strip() if tn else None),
        "tenant_profile_url": raw.get("tenant_profile_url"),
        "instagram_url": raw.get("instagram_url"),
        "instagram_handle": raw.get("instagram_handle") or instagram_handle_from_url(raw.get("instagram_url")),
        "booking_url": raw.get("booking_url"),
        "booking_provider": raw.get("booking_provider"),
        "facebook_url": raw.get("facebook_url"),
        "tiktok_url": raw.get("tiktok_url"),
        "phone": raw.get("phone"),
        "website_url": raw.get("website_url"),
        "service_category": raw.get("service_category"),
        "suite_number": raw.get("suite_number"),
        "city": raw.get("city"),
        "state": raw.get("state"),
        "zip": raw.get("zip"),
        "address_raw": raw.get("address_raw"),
        "source_type": source_type,
        "source_confidence": source_confidence,
        "extraction_notes": _as_note_list(raw.get("extraction_notes")),
    }
    # Re-run handle from final ig url
    if out.get("instagram_url") and not out.get("instagram_handle"):
        out["instagram_handle"] = instagram_handle_from_url(out["instagram_url"])
    return out
