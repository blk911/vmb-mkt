#!/usr/bin/env python3
"""
Score manually collected gray-pin search candidates against market members.

Reads JSON or JSONL candidate rows (no web/API calls). Writes scored JSON/CSV + tier splits + summary.

Expected candidate fields (tolerant; all optional except identifiers for scoring):
  market_member_id (required for matching), query, candidate_url,
  candidate_title, candidate_name, candidate_address, candidate_category,
  candidate_lat, candidate_lng | candidate_lon,
  candidate_instagram_url, candidate_booking_url, candidate_booking_provider,
  same_suite, same_building_suite, suite_match (bools)
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import sys
from collections import Counter
from pathlib import Path
from typing import Any

_PKG = Path(__file__).resolve().parent
_REPO = _PKG.parent.parent
if str(_PKG) not in sys.path:
    sys.path.insert(0, str(_PKG))

from lib.gray_pin_resolver import (  # noqa: E402
    classify_resolution_tier,
    score_candidate_against_member,
)

LOG = logging.getLogger("gray_pin_score_results")

DEFAULT_MARKETS = _REPO / "data" / "markets" / "beauty_zone_members_enriched_full.json"
DEFAULT_OUT_DIR = _REPO / "data" / "output" / "gray_pin"


def load_members_by_id(path: Path) -> dict[str, dict[str, Any]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, dict) and "members" in raw:
        rows = list(raw["members"])
    elif isinstance(raw, list):
        rows = list(raw)
    else:
        raise ValueError("markets JSON must be {members: [...]} or array")
    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        lid = str(row.get("location_id") or "").strip()
        if lid:
            out[lid] = row
    return out


def load_candidates(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return []
    if text.startswith("["):
        data = json.loads(text)
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
        raise ValueError("JSON root must be an array of objects")
    out: list[dict[str, Any]] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        obj = json.loads(line)
        if isinstance(obj, dict):
            out.append(obj)
    return out


def to_scoring_candidate(raw: dict[str, Any]) -> dict[str, Any]:
    """Map external row fields into shape expected by score_candidate_against_member."""
    name = raw.get("candidate_name")
    title = raw.get("candidate_title")
    lat = raw.get("candidate_lat")
    lng = raw.get("candidate_lng")
    if lng is None:
        lng = raw.get("candidate_lon")
    return {
        "discovered_name": (str(name).strip() if name is not None else "")
        or (str(title).strip() if title is not None else ""),
        "title": str(title or "").strip(),
        "name": str(name or "").strip(),
        "formatted_address": str(raw.get("candidate_address") or "").strip(),
        "address": str(raw.get("candidate_address") or "").strip(),
        "lat": lat,
        "lng": lng,
        "lon": lng,
        "instagram_url": raw.get("candidate_instagram_url"),
        "booking_url": raw.get("candidate_booking_url"),
        "booking_provider": raw.get("candidate_booking_provider"),
        "suite_match": raw.get("suite_match"),
        "same_building_suite": raw.get("same_building_suite"),
        "same_suite": raw.get("same_suite"),
    }


def build_match_notes(detail: dict[str, Any], score: int) -> str:
    parts = [
        f"score={score}",
        f"tier={detail.get('tier')}",
        f"name_sim={detail.get('name_similarity')}",
        f"addr={detail.get('address_match')}",
        f"geo={detail.get('same_geo_within_0_1_mi')}",
        f"ig_book={detail.get('ig_or_booking_found')}",
        f"suite={detail.get('same_building_suite')}",
    ]
    return "; ".join(str(p) for p in parts)


def sort_key(row: dict[str, Any]) -> tuple[str, str, str]:
    return (
        str(row.get("market_member_id") or ""),
        str(row.get("candidate_url") or ""),
        str(row.get("query") or ""),
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="Score gray-pin candidate rows against market members.")
    ap.add_argument("--markets-input", type=Path, default=DEFAULT_MARKETS, help="Zone members JSON")
    ap.add_argument(
        "--candidates-input",
        type=Path,
        required=True,
        help="JSON array or JSONL of candidate rows (see README)",
    )
    ap.add_argument("--output-dir", type=Path, default=DEFAULT_OUT_DIR)
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(levelname)s %(message)s")

    if not args.markets_input.is_file():
        LOG.error("markets file not found: %s", args.markets_input)
        return 1
    if not args.candidates_input.is_file():
        LOG.error("candidates file not found: %s", args.candidates_input)
        return 1

    members_by_id = load_members_by_id(args.markets_input)
    raw_candidates = load_candidates(args.candidates_input)
    total_read = len(raw_candidates)

    scored_rows: list[dict[str, Any]] = []
    members_touched: set[str] = set()
    tier_counts = Counter({"auto": 0, "review": 0, "discard": 0})
    with_ig = 0
    with_bp = 0

    for raw in raw_candidates:
        mid = str(raw.get("market_member_id") or "").strip()
        member = members_by_id.get(mid)
        cand_in = to_scoring_candidate(raw)

        cand_lat = raw.get("candidate_lat")
        cand_lng = raw.get("candidate_lng")
        if cand_lng is None:
            cand_lng = raw.get("candidate_lon")

        base_out: dict[str, Any] = {
            "market_member_id": mid,
            "market_member_name": str(member.get("name") or "") if member else "",
            "query": str(raw.get("query") or ""),
            "candidate_url": str(raw.get("candidate_url") or ""),
            "candidate_title": str(raw.get("candidate_title") or ""),
            "candidate_name": str(raw.get("candidate_name") or ""),
            "candidate_address": str(raw.get("candidate_address") or ""),
            "candidate_category": str(raw.get("candidate_category") or ""),
            "candidate_lat": cand_lat,
            "candidate_lng": cand_lng,
            "candidate_instagram_url": str(raw.get("candidate_instagram_url") or "").strip() or None,
            "candidate_booking_url": str(raw.get("candidate_booking_url") or "").strip() or None,
            "candidate_booking_provider": str(raw.get("candidate_booking_provider") or "").strip() or None,
        }

        if not mid:
            base_out["gray_resolution_score"] = 0
            base_out["gray_resolution_tier"] = "discard"
            base_out["gray_resolution_score_detail"] = {
                "error": "missing_market_member_id",
            }
            base_out["match_notes"] = "missing market_member_id"
            tier_counts["discard"] += 1
            scored_rows.append(base_out)
            continue

        if member is None:
            base_out["gray_resolution_score"] = 0
            base_out["gray_resolution_tier"] = "discard"
            base_out["gray_resolution_score_detail"] = {
                "error": "member_not_found",
            }
            base_out["match_notes"] = f"no member for id={mid}"
            tier_counts["discard"] += 1
            scored_rows.append(base_out)
            continue

        members_touched.add(mid)
        score, detail = score_candidate_against_member(member, cand_in)
        tier = classify_resolution_tier(score)
        detail["tier"] = tier

        if str(base_out.get("candidate_instagram_url") or "").strip():
            with_ig += 1
        if str(base_out.get("candidate_booking_provider") or "").strip():
            with_bp += 1

        base_out["gray_resolution_score"] = score
        base_out["gray_resolution_tier"] = tier
        base_out["gray_resolution_score_detail"] = detail
        base_out["match_notes"] = build_match_notes(detail, score)
        tier_counts[tier] += 1
        scored_rows.append(base_out)

    scored_rows.sort(key=sort_key)

    auto_rows = [r for r in scored_rows if r.get("gray_resolution_tier") == "auto"]
    review_rows = [r for r in scored_rows if r.get("gray_resolution_tier") == "review"]

    args.output_dir.mkdir(parents=True, exist_ok=True)
    all_path = args.output_dir / "gray_resolution_scored_candidates.json"
    auto_path = args.output_dir / "gray_resolution_auto_matches.json"
    review_path = args.output_dir / "gray_resolution_review_matches.json"
    csv_path = args.output_dir / "gray_resolution_scored_candidates.csv"
    summary_path = args.output_dir / "gray_resolution_summary.json"

    all_path.write_text(json.dumps(scored_rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    auto_path.write_text(json.dumps(auto_rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    review_path.write_text(json.dumps(review_rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    if scored_rows:
        preferred = [
            "market_member_id",
            "market_member_name",
            "query",
            "candidate_url",
            "candidate_title",
            "candidate_name",
            "candidate_address",
            "candidate_category",
            "candidate_lat",
            "candidate_lng",
            "candidate_instagram_url",
            "candidate_booking_url",
            "candidate_booking_provider",
            "gray_resolution_score",
            "gray_resolution_tier",
            "gray_resolution_score_detail",
            "match_notes",
        ]
        fieldnames = [k for k in preferred if k in scored_rows[0]]
        for r in scored_rows:
            for k in r:
                if k not in fieldnames:
                    fieldnames.append(k)
        with csv_path.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            w.writeheader()
            for r in scored_rows:
                flat = {}
                for k, v in r.items():
                    if isinstance(v, (dict, list)):
                        flat[k] = json.dumps(v, ensure_ascii=False)
                    elif v is None:
                        flat[k] = ""
                    else:
                        flat[k] = v
                w.writerow(flat)

    summary = {
        "total_candidates_read": total_read,
        "total_members_touched": len(members_touched),
        "tier_auto": tier_counts["auto"],
        "tier_review": tier_counts["review"],
        "tier_discard": tier_counts["discard"],
        "candidates_with_instagram_url": with_ig,
        "candidates_with_booking_provider": with_bp,
    }
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    LOG.info("total_candidates_read=%s", summary["total_candidates_read"])
    LOG.info("total_members_touched=%s", summary["total_members_touched"])
    LOG.info("tier_auto=%s tier_review=%s tier_discard=%s", summary["tier_auto"], summary["tier_review"], summary["tier_discard"])
    LOG.info("candidates_with_instagram_url=%s candidates_with_booking_provider=%s", with_ig, with_bp)
    LOG.info("wrote %s", args.output_dir)
    print(json.dumps(summary, indent=2))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
