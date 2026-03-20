"""
Write enriched JSON, reviewer CSV, and exceptions file.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

import pandas as pd

from .cluster_resolver import extract_point


def ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, rows: list[dict[str, Any]]) -> None:
    ensure_dir(path.parent)
    with path.open("w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2, ensure_ascii=False)


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    ensure_dir(path.parent)
    if not rows:
        pd.DataFrame().to_csv(path, index=False)
        return
    df = pd.DataFrame(rows)
    df.to_csv(path, index=False)


def write_csv_with_columns(path: Path, rows: list[dict[str, Any]], columns: tuple[str, ...]) -> None:
    """Write CSV with a fixed column order; empty rows still emit a header row."""
    ensure_dir(path.parent)
    if not rows:
        pd.DataFrame(columns=list(columns)).to_csv(path, index=False)
        return
    df = pd.DataFrame(rows)
    for c in columns:
        if c not in df.columns:
            df[c] = ""
    df = df[list(columns)]
    df.to_csv(path, index=False)


def write_exceptions(path: Path, rows: list[dict[str, Any]], as_json: bool = True) -> None:
    ensure_dir(path.parent)
    if as_json:
        with path.open("w", encoding="utf-8") as f:
            json.dump(rows, f, indent=2, ensure_ascii=False)
    else:
        write_csv(path.with_suffix(".csv"), rows)


def _nonempty_str(v: Any) -> bool:
    if v is None:
        return False
    if isinstance(v, str):
        return bool(v.strip())
    return True


def _fetch_failed_row(r: dict[str, Any]) -> bool:
    if r.get("fetch_error"):
        return True
    fs = r.get("fetch_status")
    if fs is None:
        return False
    return str(fs) != "ok"


def build_run_summary(
    enriched: list[dict[str, Any]],
    cluster_summaries: list[dict[str, Any]],
    *,
    input_row_count: int,
    processed_row_count: int,
    exception_file_counts: dict[str, int],
    exception_filenames: tuple[str, ...],
) -> dict[str, Any]:
    """Deterministic batch metrics for run_summary.json (all JSON-serializable)."""
    rows_with_valid_coords = 0
    rows_missing_coords = 0
    rows_fetch_ok = 0
    rows_fetch_failed = 0
    rows_with_best_site_name = 0
    rows_with_website_signal = 0
    rows_with_google_signal = 0
    rows_with_dora_signal = 0
    rows_with_internal_signal = 0
    rows_with_conflict_flag = 0
    match_labels: Counter[str] = Counter()
    unresolved_row_count = 0

    for r in enriched:
        if extract_point(r) is not None:
            rows_with_valid_coords += 1
        else:
            rows_missing_coords += 1

        if _fetch_failed_row(r):
            rows_fetch_failed += 1
        else:
            rows_fetch_ok += 1

        best = r.get("best_site_name")
        if _nonempty_str(best):
            rows_with_best_site_name += 1
        if _nonempty_str(best) or r.get("cluster_has_website_signal") is True:
            rows_with_website_signal += 1

        if _nonempty_str(r.get("google_name")):
            rows_with_google_signal += 1
        if _nonempty_str(r.get("dora_name")):
            rows_with_dora_signal += 1
        if _nonempty_str(r.get("internal_name")):
            rows_with_internal_signal += 1

        if r.get("cluster_name_conflict_flag") is True:
            rows_with_conflict_flag += 1

        ml = str(r.get("match_label") or "")
        match_labels[ml] += 1

        crs = (r.get("cluster_review_status") or "").strip().lower()
        if crs == "unresolved" or r.get("match_label") == "no_match":
            unresolved_row_count += 1

    cluster_count = len(cluster_summaries)
    size_counter: Counter[int] = Counter()
    crs_clusters: Counter[str] = Counter()
    unresolved_cluster_count = 0
    for s in cluster_summaries:
        mc = int(s.get("member_count") or 0)
        size_counter[mc] += 1
        st = (s.get("cluster_review_status") or "").strip().lower() or "(none)"
        crs_clusters[st] += 1
        if st == "unresolved":
            unresolved_cluster_count += 1

    cluster_size_distribution = {str(k): size_counter[k] for k in sorted(size_counter)}
    match_label_counts = {k: match_labels[k] for k in sorted(match_labels)}
    cluster_review_status_counts = {k: crs_clusters[k] for k in sorted(crs_clusters)}

    isolated_cluster_review_count = exception_file_counts.get("isolated_clusters_review.csv", 0)

    out: dict[str, Any] = {
        "input_row_count": input_row_count,
        "processed_row_count": processed_row_count,
        "rows_with_valid_coords": rows_with_valid_coords,
        "rows_missing_coords": rows_missing_coords,
        "rows_fetch_ok": rows_fetch_ok,
        "rows_fetch_failed": rows_fetch_failed,
        "rows_with_best_site_name": rows_with_best_site_name,
        "match_label_counts": match_label_counts,
        "cluster_count": cluster_count,
        "cluster_size_distribution": cluster_size_distribution,
        "cluster_review_status_counts": cluster_review_status_counts,
        "unresolved_row_count": unresolved_row_count,
        "unresolved_cluster_count": unresolved_cluster_count,
        "rows_with_website_signal": rows_with_website_signal,
        "rows_with_google_signal": rows_with_google_signal,
        "rows_with_dora_signal": rows_with_dora_signal,
        "rows_with_internal_signal": rows_with_internal_signal,
        "rows_with_conflict_flag": rows_with_conflict_flag,
        "exception_file_counts": {k: exception_file_counts[k] for k in sorted(exception_file_counts)},
        "isolated_cluster_review_count": isolated_cluster_review_count,
        "exception_files": list(exception_filenames),
    }
    return out


def write_run_summary_json(path: Path, summary: dict[str, Any]) -> None:
    ensure_dir(path.parent)
    with path.open("w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False, sort_keys=True)


def write_run_summary_txt(path: Path, summary: dict[str, Any]) -> None:
    lines = [
        "site_identity run summary",
        "-------------------------",
        f"input_row_count: {summary['input_row_count']}",
        f"processed_row_count: {summary['processed_row_count']}",
        f"rows_with_valid_coords: {summary['rows_with_valid_coords']}",
        f"rows_missing_coords: {summary['rows_missing_coords']}",
        f"rows_fetch_ok: {summary['rows_fetch_ok']}",
        f"rows_fetch_failed: {summary['rows_fetch_failed']}",
        f"rows_with_best_site_name: {summary['rows_with_best_site_name']}",
        f"cluster_count: {summary['cluster_count']}",
        f"unresolved_row_count: {summary['unresolved_row_count']}",
        f"unresolved_cluster_count: {summary['unresolved_cluster_count']}",
        f"isolated_cluster_review_count: {summary['isolated_cluster_review_count']}",
        "",
        "match_label_counts:",
    ]
    for k in sorted(summary["match_label_counts"]):
        lines.append(f"  {k}: {summary['match_label_counts'][k]}")
    lines.extend(["", "cluster_size_distribution:"])
    for k in sorted(summary["cluster_size_distribution"], key=lambda x: int(x)):
        lines.append(f"  {k}: {summary['cluster_size_distribution'][k]}")
    lines.extend(["", "cluster_review_status_counts (from cluster_summary):"])
    for k in sorted(summary["cluster_review_status_counts"]):
        lines.append(f"  {k}: {summary['cluster_review_status_counts'][k]}")
    lines.extend(
        [
            "",
            "exception_file_counts:",
        ]
    )
    for k in sorted(summary["exception_file_counts"]):
        lines.append(f"  {k}: {summary['exception_file_counts'][k]}")
    lines.extend(["", "signal counts (rows):", f"  website: {summary['rows_with_website_signal']}"])
    lines.append(f"  google: {summary['rows_with_google_signal']}")
    lines.append(f"  dora: {summary['rows_with_dora_signal']}")
    lines.append(f"  internal: {summary['rows_with_internal_signal']}")
    lines.append(f"  cluster_name_conflict_flag: {summary['rows_with_conflict_flag']}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def flatten_lists_for_csv(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Turn list values into ' | '-joined strings or JSON for nested structures."""
    out: list[dict[str, Any]] = []
    for r in rows:
        r2: dict[str, Any] = {}
        for k, v in r.items():
            if isinstance(v, list):
                if v and isinstance(v[0], dict):
                    r2[k] = json.dumps(v, ensure_ascii=False)
                else:
                    r2[k] = " | ".join(str(x) for x in v) if v else ""
            elif v is None:
                r2[k] = ""
            else:
                r2[k] = v
        out.append(r2)
    return out
