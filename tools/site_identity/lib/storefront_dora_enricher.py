"""
Conservative geo join: Places candidate rows -> nearest beauty_zone_members (location_id)
-> shop_anchor_map (DORA shop / LLC name per google_location_id).

No scoring changes; only adds optional source_name_dora + match metadata on the row dict.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from .cluster_resolver import haversine_meters

# Default repo-relative paths (resolved by caller).
DEFAULT_SHOP_ANCHOR_MAP = Path("data/markets/shop_anchor_map.v1.json")
DEFAULT_ZONE_MEMBERS = Path("data/markets/beauty_zone_members.json")

_ASSOC_BASE: dict[str, float] = {
    "strong": 0.9,
    "likely": 0.75,
    "weak": 0.55,
}


def load_shop_anchor_by_location_id(path: Path) -> dict[str, dict[str, Any]]:
    """One row per google_location_id (highest final_score wins)."""
    text = path.read_text(encoding="utf-8")
    data = json.loads(text)
    rows = data.get("rows") or []
    best: dict[str, dict[str, Any]] = {}
    for r in rows:
        gid = r.get("google_location_id")
        if not gid:
            continue
        fs = float(r.get("final_score") or 0.0)
        if gid not in best or fs > float(best[gid].get("final_score") or 0.0):
            best[str(gid)] = r
    return best


def load_zone_members(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    data = json.loads(text)
    return list(data.get("members") or [])


def _place_lat_lon(row: dict[str, Any]) -> tuple[float, float] | None:
    lat = row.get("lat")
    lon = row.get("lon")
    c = row.get("candidate")
    if isinstance(c, dict):
        if lat is None:
            lat = c.get("lat")
        if lon is None:
            lon = c.get("lon")
    if lat is None or lon is None:
        return None
    try:
        la = float(lat)
        lo = float(lon)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(la) or not math.isfinite(lo):
        return None
    return (la, lo)


def _zip_ok(row: dict[str, Any], member: dict[str, Any]) -> bool:
    zr = str(row.get("zip") or "").strip()
    zm = str(member.get("zip") or "").strip()
    if not zr or not zm:
        return True
    return zr == zm


def _nearest_member(
    lat: float,
    lon: float,
    members: list[dict[str, Any]],
    row: dict[str, Any],
    max_meters: float,
) -> tuple[dict[str, Any] | None, float | None]:
    best_m: dict[str, Any] | None = None
    best_d: float | None = None
    for m in members:
        ml = m.get("lat")
        mo = m.get("lon")
        if ml is None or mo is None:
            continue
        try:
            mla = float(ml)
            mlo = float(mo)
        except (TypeError, ValueError):
            continue
        if not _zip_ok(row, m):
            continue
        d = haversine_meters(lat, lon, mla, mlo)
        if d > max_meters:
            continue
        if best_d is None or d < best_d:
            best_d = d
            best_m = m
    return best_m, best_d


def _confidence_numeric(anchor: dict[str, Any], distance_m: float) -> float:
    ac = str(anchor.get("association_confidence") or "").lower()
    base = _ASSOC_BASE.get(ac, 0.5)
    if distance_m <= 25.0:
        df = 1.0
    elif distance_m <= 50.0:
        df = 0.95
    else:
        df = 0.9
    return round(min(1.0, base * df), 4)


def enrich_places_with_dora(
    rows: list[dict[str, Any]],
    shop_anchor_by_loc: dict[str, dict[str, Any]],
    zone_members: list[dict[str, Any]],
    *,
    max_meters: float = 75.0,
) -> list[dict[str, Any]]:
    """
    Return new list of row dicts with optional:
    source_name_dora, dora_match_type, dora_match_confidence, dora_match_evidence
    when a conservative join matches.
    """
    out: list[dict[str, Any]] = []
    for row in rows:
        r = dict(row)
        pt = _place_lat_lon(r)
        if pt is None:
            out.append(r)
            continue
        lat, lon = pt
        member, dist = _nearest_member(lat, lon, zone_members, r, max_meters)
        if member is None or dist is None:
            out.append(r)
            continue
        lid = member.get("location_id")
        if not lid:
            out.append(r)
            continue
        anchor = shop_anchor_by_loc.get(str(lid))
        if not anchor:
            out.append(r)
            continue
        shop = anchor.get("shop_name")
        if not shop or not str(shop).strip():
            out.append(r)
            continue
        r["source_name_dora"] = str(shop).strip()
        r["dora_match_type"] = "geo_nearest_zone_member_shop_anchor"
        r["dora_match_confidence"] = _confidence_numeric(anchor, dist)
        r["dora_match_evidence"] = (
            f"nearest_zone_member location_id={lid} distance_m={dist:.2f} "
            f"anchor_final_score={anchor.get('final_score')} "
            f"association_confidence={anchor.get('association_confidence')}"
        )
        out.append(r)
    return out
