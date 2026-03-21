#!/usr/bin/env python3
"""
Conservative merge: anchor_directory combined rows -> zone members (supplemental fields only).

Does not overwrite site_identity / core presence fields. Writes a new markets JSON file.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from collections import Counter
from copy import deepcopy
from pathlib import Path
from typing import Any

from rapidfuzz import fuzz

_PKG = Path(__file__).resolve().parent
_REPO = _PKG.parent.parent
if str(_PKG) not in sys.path:
    sys.path.insert(0, str(_PKG))

from lib.cluster_resolver import haversine_meters  # noqa: E402
from lib.normalize_name import build_normalized_name  # noqa: E402

STRONG_NAME_TOKEN_MIN = 0.95
SUPPORTED_NAME_TOKEN_MIN = 0.88
DIST_M_STRONG = 75.0


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


def _market_point(row: dict[str, Any]) -> tuple[float, float] | None:
    lat = _parse_float(row.get("lat"))
    lon = _parse_float(row.get("lon"))
    if lat is None or lon is None:
        return None
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        return None
    return (lat, lon)


def _anchor_point(ar: dict[str, Any]) -> tuple[float, float] | None:
    return _market_point(ar)


def _dist_m(a: tuple[float, float] | None, b: tuple[float, float] | None) -> float | None:
    if a is None or b is None:
        return None
    return haversine_meters(a[0], a[1], b[0], b[1])


def _token_ratio(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return float(fuzz.token_set_ratio(a, b)) / 100.0


def _tenant_norm(ar: dict[str, Any]) -> str:
    t = ar.get("tenant_name_norm")
    if isinstance(t, str) and t.strip():
        return t.strip().lower()
    return _norm_full(str(ar.get("tenant_name_raw") or ""))


def _context_ok(market: dict[str, Any], ar: dict[str, Any]) -> bool:
    """Location / brand hints overlap (conservative)."""
    blob = " ".join(
        [
            str(market.get("zone_name") or ""),
            str(market.get("market") or ""),
            str(market.get("city") or ""),
            str(market.get("address") or ""),
            str(market.get("name") or ""),
        ]
    ).lower()

    hint = (ar.get("anchor_cluster_hint") or "").strip()
    if hint:
        for raw in re.split(r"[;\n]", hint):
            p = raw.strip().lower()
            if len(p) < 3:
                continue
            p2 = re.sub(r"\s+location\s*$", "", p).strip()
            if len(p2) >= 3 and p2 in blob:
                return True
            if len(p) >= 3 and p in blob:
                return True

    brand = (ar.get("anchor_brand") or "").strip().lower()
    name_l = str(market.get("name") or "").lower()
    if "modern" in brand and "modern" in name_l:
        return True
    if "sola" in brand and "sola" in name_l:
        return True
    return False


def _dist_ok_strong(market: dict[str, Any], ar: dict[str, Any]) -> bool:
    pt_m = _market_point(market)
    pt_a = _anchor_point(ar)
    if pt_m is None or pt_a is None:
        return False
    d = _dist_m(pt_m, pt_a)
    return d is not None and d <= DIST_M_STRONG


def _name_strong(norm_m: str, norm_t: str) -> bool:
    if not norm_m or not norm_t:
        return False
    if norm_m == norm_t:
        return True
    return _token_ratio(norm_m, norm_t) >= STRONG_NAME_TOKEN_MIN


def _name_supported(norm_m: str, norm_t: str) -> bool:
    if not norm_m or not norm_t:
        return False
    return _token_ratio(norm_m, norm_t) >= SUPPORTED_NAME_TOKEN_MIN


def _anchor_has_presence_clue(ar: dict[str, Any]) -> bool:
    ig = (ar.get("instagram_url") or ar.get("instagram_handle") or "").strip()
    bk = (ar.get("booking_url") or ar.get("booking_provider") or "").strip()
    return bool(ig or bk)


def _stable_ar_key(ar: dict[str, Any]) -> str:
    return str(ar.get("tenant_profile_url") or ar.get("tenant_name_raw") or "")


def _apply_anchor_supplemental(row: dict[str, Any], ar: dict[str, Any], mtype: str) -> None:
    notes: list[str] = [f"match_type={mtype}"]
    nm = _norm_full(str(row.get("name") or ""))
    nt = _tenant_norm(ar)
    notes.append(f"name_token_ratio={_token_ratio(nm, nt):.3f}")

    row["anchor_directory_matched"] = True
    row["anchor_directory_brand"] = ar.get("anchor_brand")
    row["anchor_directory_location_name"] = ar.get("anchor_location_name")
    row["anchor_directory_profile_url"] = ar.get("tenant_profile_url")
    row["anchor_directory_instagram_url"] = ar.get("instagram_url")
    row["anchor_directory_instagram_handle"] = ar.get("instagram_handle")
    row["anchor_directory_booking_url"] = ar.get("booking_url")
    row["anchor_directory_booking_provider"] = ar.get("booking_provider")
    row["anchor_directory_phone"] = ar.get("phone")
    row["anchor_directory_website_url"] = ar.get("website_url")
    row["anchor_directory_match_type"] = mtype
    row["anchor_directory_match_confidence"] = "high" if mtype == "strong" else "medium"
    row["anchor_directory_match_notes"] = notes


def _init_anchor_fields(row: dict[str, Any]) -> None:
    row["anchor_directory_matched"] = False
    row["anchor_directory_brand"] = None
    row["anchor_directory_location_name"] = None
    row["anchor_directory_profile_url"] = None
    row["anchor_directory_instagram_url"] = None
    row["anchor_directory_instagram_handle"] = None
    row["anchor_directory_booking_url"] = None
    row["anchor_directory_booking_provider"] = None
    row["anchor_directory_phone"] = None
    row["anchor_directory_website_url"] = None
    row["anchor_directory_match_type"] = None
    row["anchor_directory_match_confidence"] = None
    row["anchor_directory_match_notes"] = None


def merge_members(
    market_members: list[dict[str, Any]],
    anchor_rows: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    remaining: list[dict[str, Any]] = sorted(
        [r for r in anchor_rows if isinstance(r, dict)],
        key=_stable_ar_key,
    )
    merged: list[dict[str, Any]] = []
    matched_n = 0
    strong_n = supported_n = 0
    by_brand: Counter[str] = Counter()
    gain_ig = gain_bk = 0

    for m in market_members:
        if not isinstance(m, dict):
            merged.append(m)
            continue
        row = deepcopy(m)
        _init_anchor_fields(row)

        norm_m = _norm_full(str(row.get("name") or ""))
        had_ig = bool((row.get("instagram_url") or row.get("instagram_handle") or "").strip())
        had_bk = bool((row.get("booking_url") or row.get("booking_provider") or "").strip())

        chosen: tuple[dict[str, Any], str] | None = None

        # Strong: near-exact name + (context OR distance)
        cands_strong: list[tuple[str, dict[str, Any]]] = []
        for ar in remaining:
            nt = _tenant_norm(ar)
            if not _name_strong(norm_m, nt):
                continue
            if not (_context_ok(row, ar) or _dist_ok_strong(row, ar)):
                continue
            cands_strong.append((_stable_ar_key(ar), ar))
        cands_strong.sort(key=lambda x: x[0])
        if cands_strong:
            chosen = (cands_strong[0][1], "strong")

        # Supported: high name similarity + context + presence clue on anchor
        if chosen is None:
            cands_sup: list[tuple[float, str, dict[str, Any]]] = []
            for ar in remaining:
                nt = _tenant_norm(ar)
                if not _name_supported(norm_m, nt):
                    continue
                if not _context_ok(row, ar):
                    continue
                if not _anchor_has_presence_clue(ar):
                    continue
                tr = _token_ratio(norm_m, nt)
                cands_sup.append((-tr, _stable_ar_key(ar), ar))
            cands_sup.sort(key=lambda x: (x[0], x[1]))
            if cands_sup:
                chosen = (cands_sup[0][2], "supported")

        if chosen is not None:
            ar, mtype = chosen
            _apply_anchor_supplemental(row, ar, mtype)
            matched_n += 1
            if mtype == "strong":
                strong_n += 1
            else:
                supported_n += 1
            brand = str(ar.get("anchor_brand") or "(unknown)")
            by_brand[brand] += 1
            if not had_ig and (row.get("anchor_directory_instagram_url") or row.get("anchor_directory_instagram_handle")):
                gain_ig += 1
            if not had_bk and (row.get("anchor_directory_booking_url") or row.get("anchor_directory_booking_provider")):
                gain_bk += 1
            k = _stable_ar_key(ar)
            remaining = [r for r in remaining if _stable_ar_key(r) != k]

        merged.append(row)

    stats = {
        "matched": matched_n,
        "strong": strong_n,
        "supported": supported_n,
        "by_brand": dict(sorted(by_brand.items())),
        "gain_ig": gain_ig,
        "gain_bk": gain_bk,
    }
    return merged, stats


def _load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description="Merge anchor_directory_rows_combined.json into zone members (supplemental fields only)."
    )
    ap.add_argument(
        "--markets-input",
        type=Path,
        default=_REPO / "data" / "markets" / "beauty_zone_members_enriched_with_presence.json",
        help="Source markets JSON (typically with_presence)",
    )
    ap.add_argument(
        "--anchor-input",
        type=Path,
        default=_REPO / "data" / "output" / "anchor_directories" / "anchor_directory_rows_combined.json",
        help="anchor_directory_rows_combined.json",
    )
    ap.add_argument(
        "--output",
        type=Path,
        default=_REPO / "data" / "markets" / "beauty_zone_members_enriched_with_presence_and_anchor.json",
        help="Output path",
    )
    args = ap.parse_args(argv)

    if not args.markets_input.is_file():
        print(f"ERROR: markets file not found: {args.markets_input}", file=sys.stderr)
        return 1
    if not args.anchor_input.is_file():
        print(f"ERROR: anchor combined file not found: {args.anchor_input}", file=sys.stderr)
        return 1
    if args.output.resolve() == args.markets_input.resolve():
        print("ERROR: --output must not equal --markets-input", file=sys.stderr)
        return 1

    raw_m = _load_json(args.markets_input)
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

    raw_a = _load_json(args.anchor_input)
    if isinstance(raw_a, dict) and "rows" in raw_a:
        anchor_rows = list(raw_a["rows"])
    elif isinstance(raw_a, list):
        anchor_rows = list(raw_a)
    else:
        print("ERROR: anchor JSON must be {rows: [...]} or an array", file=sys.stderr)
        return 1

    merged_members, st = merge_members(members, anchor_rows)

    if wrapper:
        doc["members"] = merged_members
        out_obj: Any = doc
    else:
        out_obj = merged_members

    _write_json(args.output, out_obj)

    total = len(merged_members)
    matched = st["matched"]
    rate = (100.0 * matched / total) if total else 0.0
    n_anchor = len([r for r in anchor_rows if isinstance(r, dict)])

    print("merge_anchor_directory_into_markets: done")
    print(f"  total market rows: {total}")
    print(f"  total anchor rows (input): {n_anchor}")
    print(f"  matched rows: {matched}")
    print(f"  match rate: {rate:.2f}%")
    print(f"  strong: {st['strong']}  supported: {st['supported']}")
    print(f"  matches by anchor brand: {st['by_brand']}")
    print(f"  rows gaining IG (no prior site_identity IG, anchor_directory IG present): {st['gain_ig']}")
    print(f"  rows gaining booking (no prior site_identity booking, anchor_directory booking present): {st['gain_bk']}")
    print(f"  wrote: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
