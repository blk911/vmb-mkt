"""
CLI: shallow site identity scrape + explainable name resolution.
"""

from __future__ import annotations

import argparse
import json
import logging
from dataclasses import asdict
from pathlib import Path
from typing import Any

import tldextract

from lib import config as site_config
from lib.cluster_resolver import apply_cluster_fields, extract_point
from lib.fetch import DomainFetchBundle, fetch_domain_pages
from lib.extract_identity import aggregate_from_pages, domain_from_url
from lib.output_writer import (
    build_run_summary,
    flatten_lists_for_csv,
    write_csv,
    write_csv_with_columns,
    write_exceptions,
    write_json,
    write_run_summary_json,
    write_run_summary_txt,
)
from lib.row_adapter import adapt_input_rows
from lib.score_match import resolve_row

LOG = logging.getLogger("site_identity")

# Reviewer-facing exception CSV columns (fixed order).
EXCEPTION_REVIEW_COLUMNS: tuple[str, ...] = (
    "id",
    "website_url_input",
    "website_url_final",
    "domain",
    "google_name",
    "dora_name",
    "internal_name",
    "best_site_name",
    "match_label",
    "cluster_id",
    "cluster_member_count",
    "cluster_review_status",
    "cluster_name_conflict_flag",
    "fetch_status",
    "fetch_error",
    "evidence_summary",
    "notes",
)

# Cluster-level file for single-member clusters needing review (see README).
ISOLATED_CLUSTER_REVIEW_COLUMNS: tuple[str, ...] = (
    "cluster_id",
    "centroid_lat",
    "centroid_lon",
    "member_count",
    "member_ids",
    "cluster_resolved_name",
    "cluster_review_status",
    "cluster_resolution_score",
    "cluster_name_conflict_flag",
    "notes",
)

# Conservative placeholder / reserved hosts (no aggressive parked-domain heuristics).
_PLACEHOLDER_DOMAINS = frozenset({"example.com", "example.org", "example.net"})

# Artifacts listed in run_summary.json and console (deterministic order).
RUN_SUMMARY_EXCEPTION_FILES: tuple[str, ...] = (
    "exceptions.json",
    "exceptions.csv",
    "exceptions_missing_coords.csv",
    "exceptions_unresolved.csv",
    "exceptions_fetch_issues.csv",
    "isolated_clusters_review.csv",
)


def pick(row: dict[str, Any], *keys: str) -> str | None:
    for k in keys:
        if k in row and row[k] not in (None, ""):
            v = row[k]
            if isinstance(v, (int, float)):
                return str(v)
            return str(v).strip()
    return None


def _notes_flat(r: dict[str, Any]) -> str:
    n = r.get("notes")
    if isinstance(n, list):
        return " | ".join(str(x) for x in n)
    return str(n) if n else ""


def project_exception_row(r: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k in EXCEPTION_REVIEW_COLUMNS:
        if k == "notes":
            out[k] = _notes_flat(r)
        else:
            v = r.get(k)
            out[k] = "" if v is None else v
    return out


def _strong_source_present(r: dict[str, Any]) -> bool:
    for k in ("google_name", "dora_name", "internal_name"):
        v = r.get(k)
        if v is not None and str(v).strip():
            return True
    return False


def _identity_evidence_weak(r: dict[str, Any]) -> bool:
    ml = r.get("match_label")
    if ml in ("ambiguous", "no_match", "weak_match"):
        return True
    ts = float(r.get("total_score") or 0.0)
    if ts < float(site_config.THRESHOLD_PROBABLE):
        return True
    best = r.get("best_site_name")
    if best is None or not str(best).strip():
        if not _strong_source_present(r):
            return True
    return False


def _is_unresolved_exception(r: dict[str, Any]) -> bool:
    crs = (r.get("cluster_review_status") or "").strip().lower()
    if crs == "unresolved":
        return True
    if r.get("match_label") == "no_match":
        return True
    best = r.get("best_site_name")
    if best is None or not str(best).strip():
        if not _strong_source_present(r):
            return True
    cid = str(r.get("cluster_id") or "").strip()
    if not cid and _identity_evidence_weak(r):
        return True
    return False


def _is_placeholder_domain(domain: str | None) -> bool:
    d = (domain or "").strip().lower()
    if not d:
        return False
    if d in _PLACEHOLDER_DOMAINS:
        return True
    if d.endswith(".example.com") or d.endswith(".example.org"):
        return True
    return False


def _is_fetch_issue(r: dict[str, Any]) -> bool:
    fs = str(r.get("fetch_status") or "ok")
    if fs != "ok":
        return True
    if r.get("fetch_error"):
        return True
    dom = str(r.get("domain") or "")
    url = r.get("website_url_final") or r.get("website_url_input") or ""
    if _is_placeholder_domain(dom):
        return True
    low = _notes_flat(r).lower()
    if "no website_url" in low or "skipped fetch" in low:
        return True
    return False


def build_exceptions_missing_coords(enriched: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = [project_exception_row(r) for r in enriched if extract_point(r) is None]
    return sorted(rows, key=lambda x: (str(x.get("id", "")), str(x.get("cluster_id", ""))))


def build_exceptions_unresolved(enriched: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = [project_exception_row(r) for r in enriched if _is_unresolved_exception(r)]
    return sorted(rows, key=lambda x: (str(x.get("id", "")), str(x.get("cluster_id", ""))))


def build_exceptions_fetch_issues(enriched: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = [project_exception_row(r) for r in enriched if _is_fetch_issue(r)]
    return sorted(rows, key=lambda x: (str(x.get("id", "")), str(x.get("cluster_id", ""))))


def build_isolated_clusters_review(cluster_summaries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """One row per qualifying cluster (not per member row)."""
    out: list[dict[str, Any]] = []
    for s in cluster_summaries:
        if int(s.get("member_count") or 0) != 1:
            continue
        st = (s.get("cluster_review_status") or "").lower()
        if st not in ("review", "unresolved"):
            continue
        ev = s.get("cluster_top_evidence") or []
        evs = " | ".join(str(x) for x in ev) if isinstance(ev, list) else str(ev)
        mids = s.get("member_ids") or []
        out.append(
            {
                "cluster_id": s.get("cluster_id"),
                "centroid_lat": s.get("centroid_lat"),
                "centroid_lon": s.get("centroid_lon"),
                "member_count": s.get("member_count"),
                "member_ids": " | ".join(str(x) for x in mids),
                "cluster_resolved_name": s.get("cluster_resolved_name"),
                "cluster_review_status": s.get("cluster_review_status"),
                "cluster_resolution_score": s.get("cluster_resolution_score"),
                "cluster_name_conflict_flag": s.get("cluster_name_conflict_flag"),
                "notes": evs,
            }
        )
    return sorted(out, key=lambda x: (x.get("cluster_id") is None, str(x.get("cluster_id"))))


def print_run_summary_console(summary: dict[str, Any]) -> None:
    """Concise deterministic batch summary for stdout."""
    crs = summary["cluster_review_status_counts"]
    order = ("confirmed", "likely", "review", "unresolved", "(none)")
    parts: list[str] = []
    for s in order:
        if s in crs:
            parts.append(f"{s}={crs[s]}")
    for k in sorted(x for x in crs if x not in order):
        parts.append(f"{k}={crs[k]}")
    lines = [
        "",
        "=== site_identity run summary ===",
        f"rows processed: {summary['processed_row_count']}  (input: {summary['input_row_count']})",
        f"coords valid / missing: {summary['rows_with_valid_coords']} / {summary['rows_missing_coords']}",
        f"fetch ok / failed: {summary['rows_fetch_ok']} / {summary['rows_fetch_failed']}",
        f"clusters: {summary['cluster_count']}  size_buckets: {summary['cluster_size_distribution']}",
        "cluster_review_status (cluster_summary): " + (", ".join(parts) if parts else "(none)"),
        f"unresolved rows (status=no_match or row unresolved): {summary['unresolved_row_count']}",
        f"unresolved clusters: {summary['unresolved_cluster_count']}",
        "exception files: " + ", ".join(summary["exception_files"]),
        "=================================",
        "",
    ]
    print("\n".join(lines), flush=True)


def _flatten_live_unit_row(row: dict[str, Any]) -> dict[str, Any]:
    """
    Flatten `beauty_live_units.v1.json`-style rows (nested raw_snippets) before row_adapter.
    Preserves original keys; adds top-level id / names / website / address for the pipeline.
    """
    if "live_unit_id" not in row or not isinstance(row.get("raw_snippets"), dict):
        return row
    out = dict(row)
    rs = row["raw_snippets"]
    g = rs.get("google") or {}
    d = rs.get("dora") or {}
    lid = row.get("live_unit_id")
    if lid is not None:
        out["id"] = str(lid)
    for k in ("lat", "lon", "city", "state", "zip"):
        if k in row and row[k] is not None:
            out[k] = row[k]
    ga = g.get("address")
    if ga:
        out["address"] = ga
    name_g = g.get("name") or row.get("name_display")
    if name_g:
        out["source_name_google"] = str(name_g).strip()
    rnames = d.get("raw_names")
    if isinstance(rnames, list) and rnames:
        out["source_name_dora"] = ", ".join(str(x).strip() for x in rnames if x)
    wd = g.get("website_domain")
    if isinstance(wd, str):
        w = wd.strip()
        if w:
            if not w.lower().startswith(("http://", "https://")):
                w = "https://" + w
            out["website_url"] = w
    return out


def _maybe_flatten_vmb_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not rows:
        return rows
    if "live_unit_id" in rows[0] and isinstance(rows[0].get("raw_snippets"), dict):
        return [_flatten_live_unit_row(r) for r in rows]
    return rows


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
    if isinstance(data, dict):
        if "rows" in data:
            return list(data["rows"])
        if "members" in data:
            return list(data["members"])
    raise ValueError("JSON must be an array, {rows: [...]}, or {members: [...]}")


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

    pt = extract_point(row)
    lat_out = pt[0] if pt else None
    lon_out = pt[1] if pt else None

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
        "lat": lat_out,
        "lon": lon_out,
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
    ap.add_argument(
        "--cluster-threshold-meters",
        type=float,
        default=site_config.DEFAULT_CLUSTER_THRESHOLD_METERS,
        help="Max Haversine distance (m) to group rows into one location cluster",
    )
    args = ap.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    rows = load_rows(args.input)
    if args.limit and args.limit > 0:
        rows = rows[: args.limit]
    rows = _maybe_flatten_vmb_rows(rows)
    rows = adapt_input_rows(rows)
    input_row_count = len(rows)

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
            pt = extract_point(row)
            enriched.append(
                {
                    "id": rid,
                    "website_url_input": pick(row, "website_url", "url"),
                    "website_url_final": None,
                    "domain": "",
                    "google_name": pick(row, "source_name_google", "google_name", "google"),
                    "dora_name": pick(row, "source_name_dora", "dora_name", "dora"),
                    "internal_name": pick(row, "source_name_internal", "internal_name", "internal"),
                    "best_site_name": None,
                    "evidence_summary": "",
                    "fetch_status": "fatal",
                    "fetch_error": str(e)[:500],
                    "match_label": "no_match",
                    "notes": [str(e)],
                    "lat": pt[0] if pt else None,
                    "lon": pt[1] if pt else None,
                }
            )

    cluster_summaries = apply_cluster_fields(enriched, args.cluster_threshold_meters)

    write_json(out_dir / "enriched.json", enriched)
    write_csv(out_dir / "review.csv", enriched)

    write_json(out_dir / "cluster_summary.json", cluster_summaries)
    write_csv(out_dir / "cluster_summary.csv", flatten_lists_for_csv(cluster_summaries))

    exceptions = [r for r in enriched if r.get("match_label") in ("ambiguous", "no_match")]
    write_exceptions(out_dir / "exceptions.json", exceptions, as_json=True)
    write_csv(out_dir / "exceptions.csv", exceptions)

    rows_exc_miss = build_exceptions_missing_coords(enriched)
    rows_exc_unres = build_exceptions_unresolved(enriched)
    rows_exc_fetch = build_exceptions_fetch_issues(enriched)
    rows_isolated = build_isolated_clusters_review(cluster_summaries)

    write_csv_with_columns(
        out_dir / "exceptions_missing_coords.csv",
        rows_exc_miss,
        EXCEPTION_REVIEW_COLUMNS,
    )
    write_csv_with_columns(
        out_dir / "exceptions_unresolved.csv",
        rows_exc_unres,
        EXCEPTION_REVIEW_COLUMNS,
    )
    write_csv_with_columns(
        out_dir / "exceptions_fetch_issues.csv",
        rows_exc_fetch,
        EXCEPTION_REVIEW_COLUMNS,
    )
    write_csv_with_columns(
        out_dir / "isolated_clusters_review.csv",
        rows_isolated,
        ISOLATED_CLUSTER_REVIEW_COLUMNS,
    )

    exception_file_counts: dict[str, int] = {
        "exceptions.json": len(exceptions),
        "exceptions.csv": len(exceptions),
        "exceptions_missing_coords.csv": len(rows_exc_miss),
        "exceptions_unresolved.csv": len(rows_exc_unres),
        "exceptions_fetch_issues.csv": len(rows_exc_fetch),
        "isolated_clusters_review.csv": len(rows_isolated),
    }
    run_summary = build_run_summary(
        enriched,
        cluster_summaries,
        input_row_count=input_row_count,
        processed_row_count=len(enriched),
        exception_file_counts=exception_file_counts,
        exception_filenames=RUN_SUMMARY_EXCEPTION_FILES,
    )
    write_run_summary_json(out_dir / "run_summary.json", run_summary)
    write_run_summary_txt(out_dir / "run_summary.txt", run_summary)
    print_run_summary_console(run_summary)

    LOG.info(
        "Wrote %s rows + %s clusters + run_summary to %s",
        len(enriched),
        len(cluster_summaries),
        out_dir,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
