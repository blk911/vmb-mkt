#!/usr/bin/env python3
"""
Emit gray-pin resolution search queries for market members (no external API calls).

Output: JSON lines (one object per gray member) with `location_id`, `queries`,
and optional `address_instagram_probe` for high-alpha address-first IG search.

Downstream: run searches manually or plug results into `score_candidate_against_member`.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any

_PKG = Path(__file__).resolve().parent
_REPO = _PKG.parent.parent
if str(_PKG) not in sys.path:
    sys.path.insert(0, str(_PKG))

from lib.gray_pin_resolver import (  # noqa: E402
    build_address_instagram_probe,
    build_gray_resolution_queries,
    member_is_gray_pin,
)

LOG = logging.getLogger("gray_pin_emit")


def load_members(path: Path) -> list[dict[str, Any]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, dict) and "members" in raw:
        return list(raw["members"])
    if isinstance(raw, list):
        return list(raw)
    raise ValueError("markets JSON must be {members: [...]} or array")


def main() -> int:
    ap = argparse.ArgumentParser(description="Emit gray-pin search queries for enrichment pipeline.")
    ap.add_argument(
        "--markets-input",
        type=Path,
        default=_REPO / "data" / "markets" / "beauty_zone_members_enriched_full.json",
    )
    ap.add_argument("--output", type=Path, default=Path("-"), help="JSONL path or - for stdout")
    ap.add_argument("--zone-id", type=str, default="", help="Optional filter: zone_id equals")
    ap.add_argument("--limit", type=int, default=0, help="Max gray members (0 = all)")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(levelname)s %(message)s")

    if not args.markets_input.is_file():
        LOG.error("file not found: %s", args.markets_input)
        return 1

    members = load_members(args.markets_input)
    n_gray = 0
    out_lines: list[str] = []

    for row in members:
        if not isinstance(row, dict):
            continue
        if not member_is_gray_pin(row):
            continue
        if args.zone_id and str(row.get("zone_id") or "") != args.zone_id:
            continue

        name = str(row.get("name") or "")
        address = str(row.get("address") or "")
        city = str(row.get("city") or "")
        state = str(row.get("state") or "")
        category = str(row.get("category") or "salon")

        queries = build_gray_resolution_queries(name, address, city, state, category)
        probe = build_address_instagram_probe(address, city, state)

        obj = {
            "location_id": str(row.get("location_id") or ""),
            "name": name,
            "zone_id": row.get("zone_id"),
            "queries": queries,
            "address_instagram_probe": probe,
        }
        out_lines.append(json.dumps(obj, ensure_ascii=False))
        n_gray += 1
        if args.limit and n_gray >= args.limit:
            break

    text = "\n".join(out_lines) + ("\n" if out_lines else "")
    if str(args.output) == "-":
        sys.stdout.write(text)
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text, encoding="utf-8")
        LOG.info("wrote %s lines to %s", len(out_lines), args.output)

    LOG.info("gray members emitted: %s", n_gray)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
