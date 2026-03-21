#!/usr/bin/env python3
"""
Anchor directory ingestion (Modern SalonStudios, Sola Salons): shallow fetch, normalize, write JSON/CSV.
Run from repo root:
  python tools/site_identity/ingest_anchor_directories.py --help
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import sys
from pathlib import Path
from typing import Any

import httpx

_PKG = Path(__file__).resolve().parent
if str(_PKG) not in sys.path:
    sys.path.insert(0, str(_PKG))

from lib.anchor_directory_extract import extract_modern_directory, extract_sola_directory
from lib.anchor_directory_normalize import normalize_directory_row

LOG = logging.getLogger("ingest_anchor_directories")

SCHEMA_FIELDS = [
    "anchor_brand",
    "anchor_location_name",
    "anchor_location_url",
    "anchor_directory_url",
    "anchor_cluster_hint",
    "tenant_name_raw",
    "tenant_name_norm",
    "tenant_profile_url",
    "instagram_url",
    "instagram_handle",
    "booking_url",
    "booking_provider",
    "facebook_url",
    "tiktok_url",
    "phone",
    "website_url",
    "service_category",
    "suite_number",
    "city",
    "state",
    "zip",
    "address_raw",
    "source_type",
    "source_confidence",
    "extraction_notes",
]


def _row_to_csv_dict(row: dict[str, Any]) -> dict[str, Any]:
    out = dict(row)
    notes = out.get("extraction_notes")
    if isinstance(notes, list):
        out["extraction_notes"] = " | ".join(str(x) for x in notes)
    return out


def _write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        with path.open("w", encoding="utf-8", newline="") as f:
            csv.DictWriter(f, fieldnames=SCHEMA_FIELDS).writeheader()
        return
    flat = [_row_to_csv_dict(r) for r in rows]
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=SCHEMA_FIELDS, extrasaction="ignore")
        w.writeheader()
        for r in flat:
            w.writerow({k: r.get(k) for k in SCHEMA_FIELDS})


def _summarize(label: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    loc_hints: set[str] = set()
    for r in rows:
        for key in ("anchor_cluster_hint", "anchor_location_name", "anchor_location_url"):
            v = r.get(key)
            if isinstance(v, str) and v.strip():
                loc_hints.add(v.strip()[:200])
                break
    ig = sum(1 for r in rows if (r.get("instagram_url") or "").strip() or (r.get("instagram_handle") or "").strip())
    bk = sum(1 for r in rows if (r.get("booking_url") or "").strip() or (r.get("booking_provider") or "").strip())
    return {
        "anchor": label,
        "row_count": len(rows),
        "rows_with_instagram": ig,
        "rows_with_booking": bk,
        "distinct_location_hints": len(loc_hints),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Ingest anchor salon-suite directory pages (Modern, Sola).")
    ap.add_argument("--modern-url", type=str, default="", help="Modern SalonStudios directory seed URL")
    ap.add_argument("--sola-url", type=str, default="", help="Sola Salons directory seed URL")
    ap.add_argument("--output-dir", type=Path, default=Path("data/output/anchor_directories"))
    ap.add_argument("--timeout", type=float, default=25.0)
    ap.add_argument("--max-profile-pages", type=int, default=200, help="Max Modern project pages + max Sola rows (0=all)")
    ap.add_argument("--max-extra-pages", type=int, default=8, help="Sola: max same-domain listing pages to fetch")
    ap.add_argument("--insecure", action="store_true", help="Disable TLS verification (dev only)")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(levelname)s %(message)s")

    if not args.modern_url.strip() and not args.sola_url.strip():
        LOG.error("Provide at least one of --modern-url or --sola-url")
        return 2

    out_dir = args.output_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    verify = not args.insecure
    modern_rows: list[dict[str, Any]] = []
    sola_rows: list[dict[str, Any]] = []

    with httpx.Client(headers={"User-Agent": "vmb-mkt-anchor-directory-ingest/1.0"}, verify=verify) as client:
        if args.modern_url.strip():
            raw = extract_modern_directory(
                client,
                args.modern_url.strip(),
                timeout=args.timeout,
                max_profile_pages=args.max_profile_pages,
            )
            modern_rows = [
                normalize_directory_row(r, anchor_brand_key="modern") for r in raw
            ]
        if args.sola_url.strip():
            raw_s = extract_sola_directory(
                client,
                args.sola_url.strip(),
                timeout=args.timeout,
                max_profile_pages=args.max_profile_pages,
                max_extra_pages=args.max_extra_pages,
            )
            sola_rows = [normalize_directory_row(r, anchor_brand_key="sola") for r in raw_s]

    combined = modern_rows + sola_rows

    def dump_json(path: Path, obj: Any) -> None:
        path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    dump_json(out_dir / "modern_directory_rows.json", {"rows": modern_rows, "source_url": args.modern_url or None})
    dump_json(out_dir / "sola_directory_rows.json", {"rows": sola_rows, "source_url": args.sola_url or None})
    dump_json(
        out_dir / "anchor_directory_rows_combined.json",
        {
            "rows": combined,
            "meta": {
                "modern_url": args.modern_url or None,
                "sola_url": args.sola_url or None,
                "modern_count": len(modern_rows),
                "sola_count": len(sola_rows),
            },
        },
    )

    _write_csv(out_dir / "modern_directory_rows.csv", modern_rows)
    _write_csv(out_dir / "sola_directory_rows.csv", sola_rows)
    _write_csv(out_dir / "anchor_directory_rows_combined.csv", combined)

    summary = {
        "modern": _summarize("Modern SalonStudios", modern_rows),
        "sola": _summarize("Sola Salons", sola_rows),
        "combined_row_count": len(combined),
    }
    dump_json(out_dir / "anchor_directory_summary.json", summary)

    # Console validation
    print("=== anchor directory ingest ===")
    for part in ("modern", "sola"):
        s = summary[part]
        print(
            f"{part}: rows={s['row_count']}  with_instagram={s['rows_with_instagram']}  "
            f"with_booking={s['rows_with_booking']}  distinct_location_hints={s['distinct_location_hints']}"
        )
    print(f"combined rows: {summary['combined_row_count']}")
    print(f"wrote: {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
