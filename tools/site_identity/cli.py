"""
CLI: shallow site identity scrape + explainable name resolution.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

import tldextract

from lib.fetch import DomainFetchBundle, fetch_domain_pages
from lib.extract_identity import aggregate_from_pages, domain_from_url
from lib.output_writer import write_csv, write_exceptions, write_json
from lib.score_match import resolve_row

LOG = logging.getLogger("site_identity")


def pick(row: dict[str, Any], *keys: str) -> str | None:
    for k in keys:
        if k in row and row[k] not in (None, ""):
            v = row[k]
            if isinstance(v, (int, float)):
                return str(v)
            return str(v).strip()
    return None


def load_rows(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    path_s = str(path).lower()
    if path_s.endswith(".jsonl"):
        out = []
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            out.append(json.loads(line))
        return out
    data = json.loads(text)
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "rows" in data:
        return list(data["rows"])
    raise ValueError("JSON must be an array or {rows: [...]}")


def row_to_enriched(
    row: dict[str, Any],
    bundle: DomainFetchBundle,
    candidates: list[Any],
    phones: list[str],
    emails: list[str],
    addrs: list[str],
    booking: list[str],
    social: list[str],
    resolution: Any,
    fetch_notes: list[str],
) -> dict[str, Any]:
    first = bundle.pages[0] if bundle.pages else None
    final_url = first.final_url if first else pick(row, "website_url", "url")
    ext = tldextract.extract(final_url or "")
    domain_key = f"{ext.domain}.{ext.suffix}" if ext.suffix else (ext.domain or "")

    fetch_status = "ok"
    fetch_error = None
    if first and first.error and not first.html:
        fetch_status = "error"
        fetch_error = first.error
    elif first and first.status_code and first.status_code >= 400:
        fetch_status = f"http_{first.status_code}"
        fetch_error = first.error

    notes = list(fetch_notes) + (resolution.evidence if resolution else [])
    if not candidates:
        notes.append("No identity name candidates after extraction.")

    rid = pick(row, "id", "ID") or "unknown"

    return {
        "id": rid,
        "website_url_input": pick(row, "website_url", "url"),
        "website_url_final": final_url,
        "domain": domain_key or domain_from_url(final_url or ""),
        "google_name": pick(row, "source_name_google", "google_name", "google"),
        "dora_name": pick(row, "source_name_dora", "dora_name", "dora"),
        "internal_name": pick(row, "source_name_internal", "internal_name", "internal"),
        "best_site_name": resolution.best_site_name if resolution else None,
        "best_site_name_norm": resolution.best_site_name_norm if resolution else None,
        "match_label": resolution.match_label if resolution else "no_match",
        "total_score": resolution.total_score if resolution else 0.0,
        "score_name_similarity": resolution.score_name_similarity if resolution else 0.0,
        "score_address_bonus": resolution.score_address_bonus if resolution else 0.0,
        "score_phone_bonus": resolution.score_phone_bonus if resolution else 0.0,
        "evidence_summary": " | ".join(resolution.evidence[:12]) if resolution else "",
        "extracted_phones": phones,
        "extracted_emails": emails,
        "extracted_addresses": addrs,
        "extracted_booking_hints": booking,
        "extracted_social_links": social,
        "extracted_name_candidates": [asdict(c) for c in candidates],
        "score_breakdown": resolution.score_breakdown if resolution else {},
        "ambiguous_reason": resolution.ambiguous_reason if resolution else None,
        "matched_against": resolution.matched_against if resolution else None,
        "notes": notes,
        "fetch_status": fetch_status,
        "fetch_error": fetch_error,
        "pages_fetched": len(bundle.pages),
    }


def process_one(
    row: dict[str, Any],
    timeout: float,
    max_pages: int,
    verify_ssl: bool = True,
) -> dict[str, Any]:
    url = pick(row, "website_url", "url")
    google = pick(row, "source_name_google", "google_name", "google")
    dora = pick(row, "source_name_dora", "dora_name", "dora")
    internal = pick(row, "source_name_internal", "internal_name", "internal")
    phone = pick(row, "phone", "Phone")
    addr = pick(row, "address", "Address")
    if not addr:
        parts = [pick(row, "city"), pick(row, "state"), pick(row, "zip")]
        addr = ", ".join(p for p in parts if p) or None

    if not url:
        res = resolve_row(google, dora, internal, phone, addr, [], [], [], "")
        return row_to_enriched(
            row,
            DomainFetchBundle(homepage_url="", pages=[], notes=["skipped_no_url"]),
            [],
            [],
            [],
            [],
            [],
            [],
            res,
            ["no website_url — skipped fetch"],
        )

    bundle = fetch_domain_pages(url, timeout=timeout, max_pages=max_pages, verify_ssl=verify_ssl)
    pages_data: list[tuple[str, str | None]] = [(p.final_url, p.html) for p in bundle.pages]
    candidates, phones, emails, addrs, booking, social = aggregate_from_pages(pages_data)

    final_url = bundle.pages[0].final_url if bundle.pages else url
    ext = tldextract.extract(final_url)
    domain_key = f"{ext.domain}.{ext.suffix}" if ext.suffix else (ext.domain or "")

    res = resolve_row(google, dora, internal, phone, addr, candidates, phones, addrs, domain_key)
    return row_to_enriched(row, bundle, candidates, phones, emails, addrs, booking, social, res, bundle.notes)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Shallow salon website identity + name resolution")
    ap.add_argument("--input", "-i", required=True, type=Path, help="Input JSON or JSONL")
    ap.add_argument("--output-dir", "-o", required=True, type=Path, help="Output directory")
    ap.add_argument("--limit", type=int, default=0, help="Max rows (0 = all)")
    ap.add_argument("--timeout", type=float, default=12.0, help="HTTP timeout seconds")
    ap.add_argument("--max-pages", type=int, default=8, help="Max pages per domain")
    ap.add_argument("-v", "--verbose", action="store_true")
    ap.add_argument(
        "--insecure",
        action="store_true",
        help="Disable TLS certificate verification (broken Python cert store / dev only)",
    )
    args = ap.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    rows = load_rows(args.input)
    if args.limit and args.limit > 0:
        rows = rows[: args.limit]

    out_dir = args.output_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    enriched: list[dict[str, Any]] = []
    for i, row in enumerate(rows):
        rid = pick(row, "id", "ID") or i
        LOG.info("Row %s/%s id=%s", i + 1, len(rows), rid)
        try:
            er = process_one(
                row,
                timeout=args.timeout,
                max_pages=args.max_pages,
                verify_ssl=not args.insecure,
            )
            enriched.append(er)
        except Exception as e:
            LOG.exception("Row failed id=%s: %s", rid, e)
            enriched.append(
                {
                    "id": rid,
                    "fetch_status": "fatal",
                    "fetch_error": str(e)[:500],
                    "match_label": "no_match",
                    "notes": [str(e)],
                }
            )

    write_json(out_dir / "enriched.json", enriched)
    write_csv(out_dir / "review.csv", enriched)

    exceptions = [r for r in enriched if r.get("match_label") in ("ambiguous", "no_match")]
    write_exceptions(out_dir / "exceptions.json", exceptions, as_json=True)
    write_csv(out_dir / "exceptions.csv", exceptions)

    LOG.info("Wrote %s rows to %s", len(enriched), out_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
