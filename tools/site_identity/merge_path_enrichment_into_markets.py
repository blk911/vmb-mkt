#!/usr/bin/env python3
"""
Conservative merge: path enrichment candidates -> zone members (supplemental fields only).

Does not overwrite core site_identity / presence fields. Writes beauty_zone_members_enriched_full.json.
"""

from __future__ import annotations

import argparse
import json
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

from lib.anchor_directory_normalize import instagram_handle_from_url  # noqa: E402
from lib.normalize_name import build_normalized_name  # noqa: E402

SOURCE_PRIORITY = (
    "official_team_page",
    "booking_profile",
    "anchor_profile",
    "linked_social",
    "linked_contact",
)

STRONG_NAME_FOR_PATH_TYPES = frozenset({"official_team_page", "booking_profile"})
NAME_ALIGN_MIN = 0.85
PARENT_BRAND_ALIGN_MIN = 0.55


def _norm_full(s: str) -> str:
    return build_normalized_name(s or "").full_compare


def _token_ratio(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return float(fuzz.token_set_ratio(a, b)) / 100.0


def _digits_phone(raw: Any) -> str | None:
    if raw is None:
        return None
    s = re.sub(r"\D", "", str(raw))
    return s if len(s) >= 10 else None


def _host_from_url(url: Any) -> str | None:
    if not url or not str(url).strip():
        return None
    try:
        from urllib.parse import urlparse

        h = (urlparse(str(url).strip()).netloc or "").lower()
    except Exception:
        return None
    if h.startswith("www."):
        h = h[4:]
    return h or None


def _member_instagram_handles(m: dict[str, Any]) -> set[str]:
    out: set[str] = set()
    for key in ("instagram_handle",):
        v = m.get(key)
        if isinstance(v, str) and v.strip():
            h = v.strip().lstrip("@").lower()
            if h:
                out.add(h)
    for key in ("instagram_url", "anchor_directory_instagram_url"):
        u = m.get(key)
        if u:
            h = instagram_handle_from_url(str(u))
            if h:
                out.add(h.lower())
    ah = m.get("anchor_directory_instagram_handle")
    if isinstance(ah, str) and ah.strip():
        out.add(ah.strip().lstrip("@").lower())
    return out


def _member_booking_providers(m: dict[str, Any]) -> set[str]:
    out: set[str] = set()
    for key in ("booking_provider", "anchor_directory_booking_provider"):
        v = m.get(key)
        if isinstance(v, str) and v.strip():
            out.add(v.strip().lower())
    return out


def _member_domains(m: dict[str, Any]) -> set[str]:
    out: set[str] = set()
    for key in ("website_url", "anchor_directory_website_url", "booking_url", "anchor_directory_booking_url"):
        h = _host_from_url(m.get(key))
        if h:
            out.add(h)
    pu = m.get("anchor_directory_profile_url")
    h = _host_from_url(pu)
    if h:
        out.add(h)
    return out


def _discovered_ig_handle(c: dict[str, Any]) -> str | None:
    h = (c.get("discovered_instagram_handle") or "").strip()
    if h.startswith("@"):
        h = h[1:]
    h = h.lower()
    if h:
        return h
    u = c.get("discovered_instagram_url")
    if u:
        hh = instagram_handle_from_url(str(u))
        if hh:
            return hh.lower()
    return None


def _domains_related(a: str, b: str) -> bool:
    a = (a or "").strip().lower()
    b = (b or "").strip().lower()
    if not a or not b:
        return False
    if a == b:
        return True
    return a.endswith("." + b) or b.endswith("." + a)


def corroborates(member: dict[str, Any], cand: dict[str, Any]) -> bool:
    """At least one corroborating signal for medium-confidence auto-merge."""
    ig = _discovered_ig_handle(cand)
    if ig and ig in _member_instagram_handles(member):
        return True
    du = (cand.get("discovered_instagram_url") or "").strip().lower()
    mu = (member.get("instagram_url") or "").strip().lower()
    if du and mu and du == mu:
        return True

    dp = (cand.get("discovered_booking_provider") or "").strip().lower()
    if dp and dp in _member_booking_providers(member):
        return True

    dd = (cand.get("discovered_domain") or "").strip().lower()
    for md in _member_domains(member):
        if dd and md and _domains_related(dd, md):
            return True

    pst = cand.get("path_source_type") or ""
    if pst in STRONG_NAME_FOR_PATH_TYPES:
        dn = cand.get("discovered_name_norm") or ""
        mn = _norm_full(str(member.get("name") or ""))
        if dn and mn and _token_ratio(dn, mn) >= NAME_ALIGN_MIN:
            return True

    pb = str(cand.get("parent_brand_name") or "").strip()
    mn2 = _norm_full(str(member.get("name") or ""))
    zn = _norm_full(str(member.get("zone_name") or ""))
    if pb:
        npb = _norm_full(pb)
        if mn2 and _token_ratio(npb, mn2) >= PARENT_BRAND_ALIGN_MIN:
            return True
        if zn and _token_ratio(npb, zn) >= PARENT_BRAND_ALIGN_MIN:
            return True

    return False


def is_safe_for_auto_merge(member: dict[str, Any], cand: dict[str, Any]) -> bool:
    conf = (cand.get("path_confidence") or "low").lower()
    if conf == "low":
        return False
    if conf == "high":
        return True
    if conf == "medium":
        return corroborates(member, cand)
    return False


def _sort_key(cand: dict[str, Any]) -> tuple[int, int, str]:
    conf = (cand.get("path_confidence") or "low").lower()
    ci = 0 if conf == "high" else (1 if conf == "medium" else 2)
    st = cand.get("path_source_type") or ""
    try:
        spi = SOURCE_PRIORITY.index(st)
    except ValueError:
        spi = 99
    du = str(cand.get("discovered_url") or "")
    return (ci, spi, du)


def safe_list_conflicts(safe: list[dict[str, Any]]) -> bool:
    """Multiple safe candidates disagree on a non-empty identity field."""
    igs: list[str] = []
    for c in safe:
        h = _discovered_ig_handle(c)
        if h:
            igs.append(h)
    if len(set(igs)) > 1:
        return True

    bks: list[str] = []
    for c in safe:
        p = (c.get("discovered_booking_provider") or "").strip().lower()
        if p:
            bks.append(p)
    if len(set(bks)) > 1:
        return True

    phs: list[str] = []
    for c in safe:
        d = _digits_phone(c.get("discovered_phone"))
        if d:
            phs.append(d)
    if len(set(phs)) > 1:
        return True
    return False


def _apply_winner(row: dict[str, Any], winner: dict[str, Any], match_count: int, notes: list[str]) -> None:
    row["path_enrichment_matched"] = True
    row["path_enrichment_match_count"] = match_count
    row["path_enrichment_best_source_type"] = winner.get("path_source_type")
    row["path_enrichment_best_confidence"] = winner.get("path_confidence")
    row["path_enrichment_instagram_url"] = winner.get("discovered_instagram_url")
    row["path_enrichment_instagram_handle"] = winner.get("discovered_instagram_handle")
    row["path_enrichment_booking_url"] = winner.get("discovered_booking_url")
    row["path_enrichment_booking_provider"] = winner.get("discovered_booking_provider")
    row["path_enrichment_phone"] = winner.get("discovered_phone")
    row["path_enrichment_website_url"] = winner.get("discovered_website_url")
    row["path_enrichment_source_url"] = winner.get("source_url") or winner.get("discovered_url")
    row["path_enrichment_match_notes"] = "; ".join(notes) if notes else None


def _init_path_fields(row: dict[str, Any]) -> None:
    row["path_enrichment_matched"] = False
    row["path_enrichment_match_count"] = 0
    row["path_enrichment_best_source_type"] = None
    row["path_enrichment_best_confidence"] = None
    row["path_enrichment_instagram_url"] = None
    row["path_enrichment_instagram_handle"] = None
    row["path_enrichment_booking_url"] = None
    row["path_enrichment_booking_provider"] = None
    row["path_enrichment_phone"] = None
    row["path_enrichment_website_url"] = None
    row["path_enrichment_source_url"] = None
    row["path_enrichment_match_notes"] = None


def merge_path_enrichment(
    market_members: list[dict[str, Any]],
    candidates: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    by_member: dict[str, list[dict[str, Any]]] = {}
    for c in candidates:
        if not isinstance(c, dict):
            continue
        mid = str(c.get("market_member_id") or "").strip()
        if not mid:
            continue
        by_member.setdefault(mid, []).append(c)

    for mid in by_member:
        by_member[mid].sort(key=_sort_key)

    holdout: list[dict[str, Any]] = []

    merged_conf = Counter()
    merged_src = Counter()
    auto_merged = 0
    gain_ig = 0
    gain_bk = 0
    gain_ph = 0

    out_members: list[dict[str, Any]] = []
    for row in market_members:
        if not isinstance(row, dict):
            out_members.append(row)
            continue
        _init_path_fields(row)
        lid = str(row.get("location_id") or "").strip()
        cands = by_member.get(lid, [])

        safe = [c for c in cands if is_safe_for_auto_merge(row, c)]
        unsafe = [c for c in cands if c not in safe]

        for c in unsafe:
            conf = (c.get("path_confidence") or "low").lower()
            reason = "low_confidence" if conf == "low" else "medium_no_corroboration"
            holdout.append(
                {
                    "market_member_id": lid,
                    "holdout_reason": reason,
                    "candidate": c,
                }
            )

        if not safe:
            out_members.append(row)
            continue

        if safe_list_conflicts(safe):
            for c in safe:
                holdout.append(
                    {
                        "market_member_id": lid,
                        "holdout_reason": "conflict",
                        "candidate": c,
                    }
                )
            out_members.append(row)
            continue

        safe_sorted = sorted(safe, key=_sort_key)
        winner = safe_sorted[0]
        match_count = len(safe)

        notes: list[str] = []
        notes.append(f"winner_sort={_sort_key(winner)}")
        if match_count > 1:
            notes.append(f"alternate_safe_count={match_count - 1}")
        pmn = winner.get("path_match_notes")
        if isinstance(pmn, list):
            notes.extend(str(x) for x in pmn if x is not None)
        elif pmn:
            notes.append(str(pmn))
        exn = winner.get("extraction_notes")
        if isinstance(exn, list):
            notes.extend(str(x) for x in exn if x is not None)
        elif exn:
            notes.append(str(exn))

        _apply_winner(row, winner, match_count, notes)
        auto_merged += 1
        conf = (winner.get("path_confidence") or "low").lower()
        merged_conf[conf] += 1
        merged_src[str(winner.get("path_source_type") or "unknown")] += 1

        if match_count > 1:
            for c in safe_sorted[1:]:
                holdout.append(
                    {
                        "market_member_id": lid,
                        "holdout_reason": "not_winner",
                        "candidate": c,
                    }
                )

        had_ig = bool((row.get("instagram_url") or "").strip()) or bool(
            (row.get("anchor_directory_instagram_url") or "").strip()
        )
        had_bk = bool((row.get("booking_url") or "").strip()) or bool(
            (row.get("booking_provider") or "").strip()
        ) or bool((row.get("anchor_directory_booking_url") or "").strip())
        had_ph = bool((row.get("phone") or "").strip())

        if (winner.get("discovered_instagram_url") or winner.get("discovered_instagram_handle")) and not had_ig:
            gain_ig += 1
        if (winner.get("discovered_booking_url") or winner.get("discovered_booking_provider")) and not had_bk:
            gain_bk += 1
        if winner.get("discovered_phone") and not had_ph:
            gain_ph += 1

        out_members.append(row)

    stats = {
        "auto_merged_rows": auto_merged,
        "merged_by_confidence": dict(sorted(merged_conf.items())),
        "merged_by_path_source_type": dict(sorted(merged_src.items())),
        "rows_gaining_instagram_via_path": gain_ig,
        "rows_gaining_booking_via_path": gain_bk,
        "rows_gaining_phone_via_path": gain_ph,
    }
    return out_members, stats, holdout


def _load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description="Merge safe path enrichment candidates into zone members (supplemental fields only)."
    )
    ap.add_argument(
        "--markets-input",
        type=Path,
        default=_REPO / "data" / "markets" / "beauty_zone_members_enriched_with_presence_and_anchor.json",
        help="Source markets JSON (typically with_presence_and_anchor)",
    )
    ap.add_argument(
        "--candidates-input",
        type=Path,
        default=_REPO / "data" / "output" / "path_enrichment" / "cluster_member_path_candidates.json",
        help="cluster_member_path_candidates.json",
    )
    ap.add_argument(
        "--output",
        type=Path,
        default=_REPO / "data" / "markets" / "beauty_zone_members_enriched_full.json",
        help="Output path (beauty_zone_members_enriched_full.json)",
    )
    ap.add_argument(
        "--holdout-output",
        type=Path,
        default=_REPO / "data" / "output" / "path_enrichment" / "path_candidates_holdout.json",
        help="Non-merged / conflict / not_winner candidates",
    )
    args = ap.parse_args(argv)

    if not args.markets_input.is_file():
        print(f"ERROR: markets file not found: {args.markets_input}", file=sys.stderr)
        return 1
    if not args.candidates_input.is_file():
        print(f"ERROR: candidates file not found: {args.candidates_input}", file=sys.stderr)
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

    raw_c = _load_json(args.candidates_input)
    if isinstance(raw_c, dict) and "candidates" in raw_c:
        cands = list(raw_c["candidates"])
    elif isinstance(raw_c, list):
        cands = list(raw_c)
    else:
        print("ERROR: candidates JSON must be {candidates: [...]} or an array", file=sys.stderr)
        return 1

    merged_members, st, holdout = merge_path_enrichment(members, cands)

    if wrapper:
        doc["members"] = merged_members
        out_obj: Any = doc
    else:
        out_obj = merged_members

    _write_json(args.output, out_obj)

    holdout_doc = {
        "summary": {
            "holdout_entries": len(holdout),
            "reasons": dict(Counter(e.get("holdout_reason") or "unknown" for e in holdout)),
        },
        "entries": holdout,
    }
    _write_json(args.holdout_output, holdout_doc)

    total = len(merged_members)
    print("merge_path_enrichment_into_markets: done")
    print(f"  total market rows: {total}")
    print(f"  total path candidates (input): {len(cands)}")
    print(f"  auto-merged rows: {st['auto_merged_rows']}")
    print(f"  merged by confidence: {st['merged_by_confidence']}")
    print(f"  merged by path_source_type: {st['merged_by_path_source_type']}")
    print(f"  rows gaining instagram (core empty): {st['rows_gaining_instagram_via_path']}")
    print(f"  rows gaining booking (core empty): {st['rows_gaining_booking_via_path']}")
    print(f"  rows gaining phone (core empty): {st['rows_gaining_phone_via_path']}")
    print(f"  wrote: {args.output}")
    print(f"  holdout: {args.holdout_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
