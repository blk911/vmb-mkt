#!/usr/bin/env python3
"""
Deterministic merge: site_identity enriched rows -> beauty zone members JSON.

Does not mutate inputs. Writes a new markets file for UI consumption.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any

from rapidfuzz import fuzz

# Package root: tools/site_identity/
_PKG = Path(__file__).resolve().parent
_REPO = _PKG.parent.parent
if str(_PKG) not in sys.path:
    sys.path.insert(0, str(_PKG))

from lib.cluster_resolver import haversine_meters  # noqa: E402
from lib.normalize_name import build_normalized_name  # noqa: E402

PRESENCE_FIELDS = (
    "instagram_url",
    "instagram_handle",
    "facebook_url",
    "tiktok_url",
    "yelp_url",
    "linktree_url",
    "booking_url",
    "booking_provider",
)

META_MATCHED = "site_identity_matched"
META_TYPE = "site_identity_match_type"
META_DIST = "site_identity_match_distance_m"


def _parse_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    try:
        if isinstance(value, str):
            s = value.strip()
            if not s:
                return None
            x = float(s.replace(",", ""))
        else:
            x = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(x):
        return None
    return x


def _norm_full(s: str) -> str:
    return build_normalized_name(s or "").full_compare


def _si_display_name(row: dict[str, Any]) -> str:
    for k in ("google_name", "best_site_name", "dora_name"):
        v = row.get(k)
        if v is not None and str(v).strip():
            return str(v).strip()
    return ""


def _si_point(row: dict[str, Any]) -> tuple[float, float] | None:
    lat = _parse_float(row.get("lat"))
    lon = _parse_float(row.get("lon"))
    if lat is None or lon is None:
        return None
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        return None
    return (lat, lon)


def _market_point(row: dict[str, Any]) -> tuple[float, float] | None:
    return _si_point(row)


def _dist_m(a: tuple[float, float] | None, b: tuple[float, float] | None) -> float | None:
    if a is None or b is None:
        return None
    return haversine_meters(a[0], a[1], b[0], b[1])


def _token_ratio(a_full: str, b_full: str) -> float:
    if not a_full or not b_full:
        return 0.0
    return float(fuzz.token_set_ratio(a_full, b_full)) / 100.0


def _load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def merge_members(
    market_members: list[dict[str, Any]],
    si_rows: list[dict[str, Any]],
    *,
    strong_m: float = 75.0,
    medium_m: float = 75.0,
    fallback_m: float = 30.0,
    medium_token_min: float = 0.8,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """
    For each market row (fixed order), assign at most one site_identity row from a remaining pool.
    Returns (merged_members, stats).
    """
    # Deterministic pool: sort by string id
    remaining: list[dict[str, Any]] = sorted(
        [r for r in si_rows if isinstance(r, dict)],
        key=lambda r: str(r.get("id") or ""),
    )

    merged: list[dict[str, Any]] = []
    strong_n = medium_n = fallback_n = 0
    matched_n = 0

    for m in market_members:
        if not isinstance(m, dict):
            merged.append(m)
            continue
        row = deepcopy(m)
        name_m = str(row.get("name") or "").strip()
        norm_m = _norm_full(name_m)
        pt_m = _market_point(row)

        row[META_MATCHED] = False
        row[META_TYPE] = None
        row[META_DIST] = None

        chosen: tuple[dict[str, Any], str, float | None] | None = None

        def try_strong() -> tuple[dict[str, Any], str, float | None] | None:
            cands: list[tuple[str, dict[str, Any], float | None]] = []
            for si in remaining:
                nm = _si_display_name(si)
                norm_si = _norm_full(nm)
                if not norm_m or not norm_si:
                    continue
                if norm_m != norm_si:
                    continue
                pt_si = _si_point(si)
                d = _dist_m(pt_m, pt_si)
                if d is None:
                    continue
                if d <= strong_m:
                    sid = str(si.get("id") or "")
                    cands.append((sid, si, d))
            if not cands:
                return None
            cands.sort(key=lambda x: x[0])
            sid, si, d = cands[0]
            return (si, "strong", d)

        def try_medium() -> tuple[dict[str, Any], str, float | None] | None:
            # Highest token ratio wins; tie-break lexicographic si id.
            best_key: tuple[float, str] | None = None
            best_si: dict[str, Any] | None = None
            best_d: float | None = None
            for si in remaining:
                nm = _si_display_name(si)
                norm_si = _norm_full(nm)
                if not norm_m or not norm_si:
                    continue
                r = _token_ratio(norm_m, norm_si)
                if r < medium_token_min:
                    continue
                pt_si = _si_point(si)
                d = _dist_m(pt_m, pt_si)
                if d is None:
                    continue
                if d > medium_m:
                    continue
                sid = str(si.get("id") or "")
                key = (-r, sid)
                if best_key is None or key < best_key:
                    best_key = key
                    best_si = si
                    best_d = d
            if best_si is None:
                return None
            return (best_si, "medium", best_d)

        def try_fallback() -> tuple[dict[str, Any], str, float | None] | None:
            close: list[tuple[str, dict[str, Any], float]] = []
            for si in remaining:
                pt_si = _si_point(si)
                d = _dist_m(pt_m, pt_si)
                if d is None:
                    continue
                if d <= fallback_m:
                    sid = str(si.get("id") or "")
                    close.append((sid, si, d))
            if len(close) != 1:
                return None
            _sid, si, d = close[0]
            return (si, "fallback", d)

        if pt_m is not None:
            chosen = try_strong()
            if chosen is None:
                chosen = try_medium()
            if chosen is None:
                chosen = try_fallback()
        # No distance-based match without coords on market row
        else:
            chosen = None

        if chosen is not None:
            si, mtype, dist_val = chosen
            sid = str(si.get("id") or "")
            for k in PRESENCE_FIELDS:
                v = si.get(k)
                if v is not None and v != "":
                    row[k] = v
            row[META_MATCHED] = True
            row[META_TYPE] = mtype
            row[META_DIST] = round(dist_val, 3) if dist_val is not None else None
            matched_n += 1
            if mtype == "strong":
                strong_n += 1
            elif mtype == "medium":
                medium_n += 1
            else:
                fallback_n += 1
            remaining = [r for r in remaining if str(r.get("id") or "") != sid]

        merged.append(row)

    stats = {
        "matched": matched_n,
        "strong": strong_n,
        "medium": medium_n,
        "fallback": fallback_n,
    }
    return merged, stats


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Merge site_identity enriched.json into zone members (presence fields).")
    ap.add_argument(
        "--site-identity-input",
        type=Path,
        required=True,
        help="Path to site_identity enriched.json (array of rows)",
    )
    ap.add_argument(
        "--markets-input",
        type=Path,
        default=_REPO / "data" / "markets" / "beauty_zone_members_enriched.json",
        help="Source beauty_zone_members_enriched.json",
    )
    ap.add_argument(
        "--output",
        type=Path,
        default=_REPO / "data" / "markets" / "beauty_zone_members_enriched_with_presence.json",
        help="Output path (does not overwrite --markets-input)",
    )
    args = ap.parse_args(argv)

    markets_path = args.markets_input
    si_path = args.site_identity_input
    out_path = args.output

    if not markets_path.is_file():
        print(f"ERROR: markets file not found: {markets_path}", file=sys.stderr)
        return 1
    if not si_path.is_file():
        print(f"ERROR: site_identity file not found: {si_path}", file=sys.stderr)
        return 1
    if out_path.resolve() == markets_path.resolve():
        print("ERROR: --output must not equal --markets-input (refusing to overwrite source)", file=sys.stderr)
        return 1

    raw_m = _load_json(markets_path)
    if isinstance(raw_m, dict) and "members" in raw_m:
        members = list(raw_m["members"])
        wrapper = True
        doc = deepcopy(raw_m)
    elif isinstance(raw_m, list):
        members = list(raw_m)
        wrapper = False
        doc = None
    else:
        print("ERROR: markets JSON must be {members: [...]} or an array", file=sys.stderr)
        return 1

    raw_si = _load_json(si_path)
    if not isinstance(raw_si, list):
        print("ERROR: site_identity JSON must be an array of rows", file=sys.stderr)
        return 1

    merged_members, st = merge_members(members, raw_si)

    if wrapper:
        doc["members"] = merged_members
        out_obj: Any = doc
    else:
        out_obj = merged_members

    _write_json(out_path, out_obj)

    total = len(merged_members)
    matched = st["matched"]
    rate = (100.0 * matched / total) if total else 0.0
    ig = sum(
        1
        for r in merged_members
        if isinstance(r, dict) and (r.get("instagram_url") or r.get("instagram_handle"))
    )
    bk = sum(1 for r in merged_members if isinstance(r, dict) and (r.get("booking_url") or r.get("booking_provider")))

    print("merge_into_markets: done")
    print(f"  total market rows: {total}")
    print(f"  matched rows: {matched}")
    print(f"  match rate: {rate:.2f}%")
    print(f"  strong: {st['strong']}  medium: {st['medium']}  fallback: {st['fallback']}")
    print(f"  rows with instagram (after merge): {ig}")
    print(f"  rows with booking (after merge): {bk}")
    print(f"  wrote: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
