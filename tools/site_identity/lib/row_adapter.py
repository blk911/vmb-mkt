"""
Normalize mixed VMB / DORA / Google input keys to one canonical shape before the pipeline.

Preserves original keys; overlays canonical fields from ordered alias lists (first non-empty wins).
"""

from __future__ import annotations

from typing import Any

# target field -> alias keys in priority order
_ALIASES: dict[str, tuple[str, ...]] = {
    "id": ("id", "place_id", "facility_id", "license_id", "row_id"),
    "source_name_google": (
        "source_name_google",
        "google_name",
        "google_business_name",
        "business_name_google",
    ),
    "source_name_dora": (
        "source_name_dora",
        "dora_name",
        "facility_name",
        "legal_name",
        "business_name_dora",
    ),
    "source_name_internal": (
        "source_name_internal",
        "internal_name",
        "business_name",
        "name",
    ),
    "website_url": ("website_url", "website", "url", "domain_url"),
    "phone": ("phone", "phone_number", "formatted_phone", "business_phone"),
    "address": ("address", "street_address", "address_line_1", "full_address"),
    "city": ("city",),
    "state": ("state",),
    "zip": ("zip", "zipcode", "postal_code"),
    "lat": ("lat", "latitude"),
    "lon": ("lon", "lng", "longitude"),
}


def first_non_empty(row: dict[str, Any], keys: list[str], default: Any = "") -> Any:
    """Return the first present, non-empty value for ``keys`` in order; else ``default``."""
    for k in keys:
        if k not in row:
            continue
        v = row[k]
        if v is None:
            continue
        if isinstance(v, str):
            if not v.strip():
                continue
            return v.strip()
        if isinstance(v, bool):
            return v
        if isinstance(v, (int, float)):
            return v
        return v
    return default


def adapt_input_row(row: dict[str, Any]) -> dict[str, Any]:
    """Shallow copy of ``row`` with canonical keys filled from aliases; sets ``_adapter_applied``."""
    out: dict[str, Any] = dict(row)
    for target, aliases in _ALIASES.items():
        v = first_non_empty(row, list(aliases), default="")
        if v == "" or v is None:
            continue
        if target == "id" and not isinstance(v, str):
            out[target] = str(v).strip()
        elif isinstance(v, str):
            out[target] = v.strip()
        else:
            out[target] = v
    out["_adapter_applied"] = True
    return out


def adapt_input_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Apply :func:`adapt_input_row` in order (deterministic)."""
    return [adapt_input_row(r) for r in rows]
