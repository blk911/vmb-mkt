#!/usr/bin/env python3
"""
Merge AUTO-tier gray-pin resolution rows into zone members as supplemental fields only.

Does not overwrite core instagram_url, booking_provider, website_url, or phone.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from collections import defaultdict
from copy import deepcopy
from pathlib import Path
from typing import Any

_PKG = Path(__file__).resolve().parent
_REPO = _PKG.parent.parent
if str(_PKG) not in sys.path:
    sys.path.insert(0, str(_PKG))

LOG = logging.getLogger("merge_gray_pin")

DEFAULT_MARKETS = _REPO / "data" / "markets" / "beauty_zone_members_enriched_full.json"
DEFAULT_AUTO = _REPO / "data" / "output" / "gray_pin" / "gray_resolution_auto_matches.json"
DEFAULT_OUT = _REPO / "data" / "markets" / "beauty_zone_members_enriched_resolved.json"
DEFAULT_SUMMARY = _REPO / "data" / "output" / "gray_pin" / "gray_resolution_merge_summary.json"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def load_members_container(path: Path) -> tuple[dict[str, Any] | list[Any], bool]:
    """Return (container, is_wrapped) where wrapped means { members: [...] }."""
    raw = load_json(path)
    if isinstance(raw, dict) and "members" in raw:
        return raw, True
    if isinstance(raw, list):
        return raw, False
    raise ValueError("markets JSON must be {members: [...]} or array")


def save_members_container(container: dict[str, Any] | list[Any], is_wrapped: bool, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if is_wrapped:
        path.write_text(json.dumps(container, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    else:
        path.write_text(json.dumps(container, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _score_int(row: dict[str, Any]) -> int:
    v = row.get("gray_resolution_score")
    try:
        return int(v) if v is not None else 0
    except (TypeError, ValueError):
        return 0


def pick_winner(rows: list[dict[str, Any]]) -> tuple[dict[str, Any], int]:
    """Deterministic: higher score, then candidate_url lexicographic."""
    rows_sorted = sorted(
        rows,
        key=lambda r: (-_score_int(r), str(r.get("candidate_url") or "")),
    )
    return rows_sorted[0], len(rows)


def core_instagram_empty(m: dict[str, Any]) -> bool:
    if str(m.get("instagram_url") or "").strip():
        return False
    if str(m.get("instagram_handle") or "").strip():
        return False
    return True


def core_booking_empty(m: dict[str, Any]) -> bool:
    if str(m.get("booking_provider") or "").strip():
        return False
    if str(m.get("booking_url") or "").strip():
        return False
    return True


def is_auto_row(row: dict[str, Any]) -> bool:
    t = str(row.get("gray_resolution_tier") or "").lower().strip()
    if t == "auto":
        return True
    if not t and _score_int(row) >= 7:
        return True
    return False


def apply_gray_resolution_fields(
    member: dict[str, Any],
    winner: dict[str, Any],
    match_count: int,
) -> None:
    member["gray_resolution_matched"] = True
    member["gray_resolution_score"] = winner.get("gray_resolution_score")
    member["gray_resolution_match_url"] = str(winner.get("candidate_url") or "")
    member["gray_resolution_match_title"] = str(winner.get("candidate_title") or "")
    member["gray_resolution_match_name"] = str(winner.get("candidate_name") or "")
    member["gray_resolution_match_address"] = str(winner.get("candidate_address") or "")
    member["gray_resolution_instagram_url"] = str(winner.get("candidate_instagram_url") or "").strip() or None
    member["gray_resolution_booking_url"] = str(winner.get("candidate_booking_url") or "").strip() or None
    member["gray_resolution_booking_provider"] = str(winner.get("candidate_booking_provider") or "").strip() or None
    member["gray_resolution_source_query"] = str(winner.get("query") or "")
    member["gray_resolution_match_notes"] = str(winner.get("match_notes") or "")
    member["gray_resolution_match_count"] = match_count


def main() -> int:
    ap = argparse.ArgumentParser(description="Merge gray-pin AUTO matches into markets (supplemental fields).")
    ap.add_argument("--markets-input", type=Path, default=DEFAULT_MARKETS)
    ap.add_argument("--auto-matches-input", type=Path, default=DEFAULT_AUTO)
    ap.add_argument("--output", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--summary-output", type=Path, default=DEFAULT_SUMMARY)
    ap.add_argument("--no-summary-file", action="store_true")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(levelname)s %(message)s")

    if not args.markets_input.is_file():
        LOG.error("markets file not found: %s", args.markets_input)
        return 1
    if not args.auto_matches_input.is_file():
        LOG.error("auto matches file not found: %s", args.auto_matches_input)
        return 1

    container, is_wrapped = load_members_container(args.markets_input)
    if is_wrapped:
        members_list = list(container["members"])
        extra_keys = {k: container[k] for k in container if k != "members"}
    else:
        members_list = list(container)
        extra_keys = {}

    auto_raw = load_json(args.auto_matches_input)
    if not isinstance(auto_raw, list):
        LOG.error("auto matches must be a JSON array")
        return 1

    auto_rows = [r for r in auto_raw if isinstance(r, dict) and is_auto_row(r)]
    auto_input_count = len(auto_raw)

    by_member: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in auto_rows:
        mid = str(row.get("market_member_id") or "").strip()
        if mid:
            by_member[mid].append(row)

    by_location: dict[str, dict[str, Any]] = {}
    for m in members_list:
        if not isinstance(m, dict):
            continue
        lid = str(m.get("location_id") or "").strip()
        if lid:
            by_location[lid] = m

    total_market_rows = len(members_list)
    rows_enriched = 0
    gain_ig = 0
    gain_book = 0
    skipped_unknown = 0

    for mid, rows in by_member.items():
        if mid not in by_location:
            skipped_unknown += len(rows)
            continue
        member = by_location[mid]
        before = deepcopy(member)
        winner, cnt = pick_winner(rows)
        apply_gray_resolution_fields(member, winner, cnt)
        rows_enriched += 1

        gr_ig = str(winner.get("candidate_instagram_url") or "").strip()
        if core_instagram_empty(before) and gr_ig:
            gain_ig += 1

        gr_book = str(winner.get("candidate_booking_url") or "").strip() or str(
            winner.get("candidate_booking_provider") or ""
        ).strip()
        if core_booking_empty(before) and gr_book:
            gain_book += 1

    if is_wrapped:
        out_container: dict[str, Any] = {"members": members_list, **extra_keys}
        save_members_container(out_container, True, args.output)
    else:
        save_members_container(members_list, False, args.output)

    summary: dict[str, Any] = {
        "total_market_rows": total_market_rows,
        "auto_matches_input_rows": auto_input_count,
        "auto_matches_used_rows": len(auto_rows),
        "rows_enriched": rows_enriched,
        "rows_gaining_instagram_supplemental": gain_ig,
        "rows_gaining_booking_supplemental": gain_book,
        "skipped_unknown_member_id": skipped_unknown,
    }

    if not args.no_summary_file:
        args.summary_output.parent.mkdir(parents=True, exist_ok=True)
        args.summary_output.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    LOG.info("total_market_rows=%s", total_market_rows)
    LOG.info("auto_matches_input_rows=%s", auto_input_count)
    LOG.info("rows_enriched=%s", rows_enriched)
    LOG.info("rows_gaining_instagram_supplemental=%s", gain_ig)
    LOG.info("rows_gaining_booking_supplemental=%s", gain_book)
    print(json.dumps(summary, indent=2))
    LOG.info("wrote %s", args.output)
    if not args.no_summary_file:
        LOG.info("wrote %s", args.summary_output)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
