#!/usr/bin/env python3
"""
Path-based enrichment for cluster members: constrained fetches only (no markets file mutation).
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

import httpx
from bs4 import BeautifulSoup

_PKG = Path(__file__).resolve().parent
_REPO = _PKG.parent.parent
if str(_PKG) not in sys.path:
    sys.path.insert(0, str(_PKG))

from lib.cluster_resolver import cluster_rows_by_distance  # noqa: E402
from lib.normalize_name import build_normalized_name  # noqa: E402
from lib.anchor_directory_extract import extract_signals_from_soup, fetch_html  # noqa: E402
from lib.path_enrichment_extract import (  # noqa: E402
    booking_page_staff_links,
    collect_linked_social_candidates,
    collect_same_domain_team_links,
    extract_linkedin_style_slugs,
    name_overlap_score,
    page_title_or_h1,
    signals_to_discovered,
)
from lib.path_enrichment_normalize import discovered_domain, normalize_discovered_name  # noqa: E402
from urllib.parse import urlparse  # noqa: E402

LOG = logging.getLogger("path_enrich_cluster_members")

# Align with Next.js `getZoneMembersWithClusters` (0.12 miles).
TS_CLUSTER_THRESHOLD_M = 0.12 * 1609.344

USER_AGENT = "vmb-mkt-path-enrichment/1.0 (+https://github.com/)"

CANDIDATE_FIELDS = [
    "market_member_id",
    "market_member_name",
    "cluster_id",
    "parent_brand_name",
    "path_source_type",
    "source_url",
    "discovered_url",
    "discovered_domain",
    "discovered_name_raw",
    "discovered_name_norm",
    "discovered_phone",
    "discovered_website_url",
    "discovered_booking_url",
    "discovered_booking_provider",
    "discovered_instagram_url",
    "discovered_instagram_handle",
    "discovered_facebook_url",
    "discovered_tiktok_url",
    "path_confidence",
    "path_match_notes",
    "extraction_notes",
]


def _norm_full(s: str) -> str:
    return build_normalized_name(s or "").full_compare


def assign_zone_clusters(members: list[dict[str, Any]]) -> None:
    for m in members:
        m["_path_cluster_id"] = ""
    by_zone: dict[str, list[dict[str, Any]]] = {}
    for m in members:
        z = str(m.get("zone_id") or "UNK")
        by_zone.setdefault(z, []).append(m)
    for zid in sorted(by_zone.keys()):
        zone_members = by_zone[zid]
        clusters = cluster_rows_by_distance(zone_members, TS_CLUSTER_THRESHOLD_M)
        for ci, cl in enumerate(clusters):
            cid = f"{zid}_cluster_{ci + 1}"
            for row in cl["rows"]:
                row["_path_cluster_id"] = cid


def parent_brand_name(members: list[dict[str, Any]], cluster_id: str, zone_name: str | None) -> str | None:
    if not cluster_id:
        return (zone_name or "").strip() or None
    for m in members:
        if m.get("_path_cluster_id") == cluster_id and m.get("is_anchor"):
            n = str(m.get("name") or "").strip()
            if n:
                return n
    return (zone_name or "").strip() or None


def _empty_candidate(
    m: dict[str, Any],
    *,
    cluster_id: str,
    parent_brand: str | None,
    path_source_type: str,
    source_url: str,
    discovered_url: str,
    path_confidence: str,
    path_match_notes: list[str],
    extraction_notes: list[str],
) -> dict[str, Any]:
    return {
        "market_member_id": m.get("location_id"),
        "market_member_name": m.get("name"),
        "cluster_id": cluster_id or None,
        "parent_brand_name": parent_brand,
        "path_source_type": path_source_type,
        "source_url": source_url,
        "discovered_url": discovered_url,
        "discovered_domain": discovered_domain(discovered_url),
        "discovered_name_raw": None,
        "discovered_name_norm": None,
        "discovered_phone": None,
        "discovered_website_url": None,
        "discovered_booking_url": None,
        "discovered_booking_provider": None,
        "discovered_instagram_url": None,
        "discovered_instagram_handle": None,
        "discovered_facebook_url": None,
        "discovered_tiktok_url": None,
        "path_confidence": path_confidence,
        "path_match_notes": path_match_notes,
        "extraction_notes": extraction_notes,
    }


def _scrub_marketing_website(sig: dict[str, Any]) -> None:
    """Do not treat platform marketing homepages as tenant websites."""
    u = sig.get("website_url")
    if not u or not str(u).strip():
        return
    try:
        host = (urlparse(str(u)).netloc or "").lower()
    except Exception:
        return
    for bad in (
        "glossgenius.com",
        "vagaro.com",
        "booksy.com",
        "squareup.com",
        "square.site",
        "fresha.com",
        "mindbodyonline.com",
        "schedulicity.com",
    ):
        if bad in host:
            sig["website_url"] = None
            return


def _merge_sig_into_candidate(
    base: dict[str, Any],
    sig: dict[str, Any],
    raw_name: str | None,
) -> dict[str, Any]:
    _scrub_marketing_website(sig)
    out = dict(base)
    s = signals_to_discovered(sig)
    for k, v in s.items():
        if v is not None and str(v).strip():
            out[k] = v
    if raw_name:
        out["discovered_name_raw"] = raw_name[:500]
        out["discovered_name_norm"] = normalize_discovered_name(raw_name)
    return out


def process_member(
    m: dict[str, Any],
    *,
    members: list[dict[str, Any]],
    client: httpx.Client,
    timeout: float,
    max_team_pages: int,
    max_booking_links: int,
    max_social_links: int,
    fetch_budget: list[int],
    max_cand_member: int,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    cid = str(m.get("_path_cluster_id") or "")
    zn = str(m.get("zone_name") or "")
    parent = parent_brand_name(members, cid, zn)
    norm_m = _norm_full(str(m.get("name") or ""))

    def can_fetch() -> bool:
        return fetch_budget[0] > 0

    def spend() -> None:
        fetch_budget[0] -= 1

    def add_row(row: dict[str, Any]) -> None:
        if len(out) >= max_cand_member:
            return
        out.append(row)

    # --- Path 3: anchor directory profile ---
    apu = m.get("anchor_directory_profile_url")
    if apu and str(apu).strip().startswith("http") and can_fetch():
        url = str(apu).strip()
        html, err = fetch_html(client, url, timeout)
        spend()
        notes = ["anchor_profile_fetch", f"ok={html is not None}"]
        if err:
            notes.append(f"error={err}")
        raw_name = None
        sig: dict[str, Any] = {}
        if html:
            soup = BeautifulSoup(html, "lxml")
            raw_name = page_title_or_h1(soup)
            sig = extract_signals_from_soup(soup, url)
            sc = name_overlap_score(norm_m, raw_name)
            conf = "high" if sc >= 0.5 else ("medium" if sc >= 0.25 else "low")
            pn = [f"name_overlap={sc:.2f}"]
        else:
            conf = "low"
            pn = ["fetch_failed"]
        base = _empty_candidate(
            m,
            cluster_id=cid,
            parent_brand=parent,
            path_source_type="anchor_profile",
            source_url=url,
            discovered_url=url,
            path_confidence=conf,
            path_match_notes=pn,
            extraction_notes=notes,
        )
        base = _merge_sig_into_candidate(base, sig, raw_name)
        add_row(base)
        if html:
            soup = BeautifulSoup(html, "lxml")
            for sub in collect_linked_social_candidates(url, soup, max_links=max_social_links):
                ls = _empty_candidate(
                    m,
                    cluster_id=cid,
                    parent_brand=parent,
                    path_source_type="linked_social",
                    source_url=url,
                    discovered_url=sub.get("discovered_url") or url,
                    path_confidence="high" if conf == "high" else "medium",
                    path_match_notes=["from_anchor_profile_page"],
                    extraction_notes=["linked_social_from_anchor_profile"],
                )
                for k, v in sub.items():
                    if v is not None:
                        ls[k] = v
                add_row(ls)

    # --- Path 2: booking URL ---
    bu = m.get("booking_url") or m.get("anchor_directory_booking_url")
    if bu and str(bu).strip().startswith("http") and can_fetch():
        url = str(bu).strip()
        html, err = fetch_html(client, url, timeout)
        spend()
        notes = ["booking_page_fetch", f"ok={html is not None}"]
        if err:
            notes.append(f"error={err}")
        if html:
            soup = BeautifulSoup(html, "lxml")
            sig = extract_signals_from_soup(soup, url)
            raw_name = page_title_or_h1(soup)
            base = _empty_candidate(
                m,
                cluster_id=cid,
                parent_brand=parent,
                path_source_type="booking_profile",
                source_url=url,
                discovered_url=url,
                path_confidence="medium",
                path_match_notes=["booking_seed_page"],
                extraction_notes=notes,
            )
            base = _merge_sig_into_candidate(base, sig, raw_name)
            add_row(base)
            for blink in booking_page_staff_links(url, soup, max_links=max_booking_links):
                if not can_fetch():
                    break
                h2, e2 = fetch_html(client, blink, timeout)
                spend()
                if not h2:
                    continue
                sp2 = BeautifulSoup(h2, "lxml")
                sig2 = extract_signals_from_soup(sp2, blink)
                rn2 = page_title_or_h1(sp2)
                br = _empty_candidate(
                    m,
                    cluster_id=cid,
                    parent_brand=parent,
                    path_source_type="booking_profile",
                    source_url=url,
                    discovered_url=blink,
                    path_confidence="medium",
                    path_match_notes=["booking_staff_or_deep_link"],
                    extraction_notes=[f"follow_booking_link:{blink}"],
                )
                br = _merge_sig_into_candidate(br, sig2, rn2)
                add_row(br)
        else:
            base = _empty_candidate(
                m,
                cluster_id=cid,
                parent_brand=parent,
                path_source_type="booking_profile",
                source_url=url,
                discovered_url=url,
                path_confidence="low",
                path_match_notes=["fetch_failed"],
                extraction_notes=notes,
            )
            add_row(base)

    # --- Path 1: official team / same-domain ---
    seeds: list[str] = []
    for k in ("anchor_directory_website_url",):
        v = m.get(k)
        if v and str(v).strip().startswith("http"):
            seeds.append(str(v).strip())
    prof = m.get("anchor_directory_profile_url")
    if prof and str(prof).startswith("http"):
        p = urlparse(str(prof))
        seeds.append(f"{p.scheme}://{p.netloc}/")

    seeds = sorted(set(seeds))
    for seed in seeds[:2]:
        if not can_fetch():
            break
        html, err = fetch_html(client, seed, timeout)
        spend()
        if not html:
            continue
        soup = BeautifulSoup(html, "lxml")
        team_urls = collect_same_domain_team_links(seed, soup, max_links=max_team_pages)
        team_urls.extend(extract_linkedin_style_slugs(seed, soup, max_links=2))
        team_urls = sorted(set(team_urls))[: max_team_pages + 2]
        for tu in team_urls:
            if not can_fetch():
                break
            h3, e3 = fetch_html(client, tu, timeout)
            spend()
            if not h3:
                continue
            s3 = BeautifulSoup(h3, "lxml")
            sig3 = extract_signals_from_soup(s3, tu)
            rn3 = page_title_or_h1(s3)
            sc = name_overlap_score(norm_m, rn3)
            conf = "high" if sc >= 0.55 else ("medium" if sc >= 0.3 else "low")
            base = _empty_candidate(
                m,
                cluster_id=cid,
                parent_brand=parent,
                path_source_type="official_team_page",
                source_url=seed,
                discovered_url=tu,
                path_confidence=conf,
                path_match_notes=[f"name_overlap={sc:.2f}", "same_domain_team_path"],
                extraction_notes=[f"team_crawl:{tu}"],
            )
            base = _merge_sig_into_candidate(base, sig3, rn3)
            add_row(base)
            for sub in collect_linked_social_candidates(tu, s3, max_links=max_social_links):
                ls = _empty_candidate(
                    m,
                    cluster_id=cid,
                    parent_brand=parent,
                    path_source_type="linked_social",
                    source_url=tu,
                    discovered_url=sub.get("discovered_url") or tu,
                    path_confidence="medium" if conf != "high" else "high",
                    path_match_notes=["from_official_team_page"],
                    extraction_notes=["linked_social_from_team_page"],
                )
                for k, v in sub.items():
                    if v is not None:
                        ls[k] = v
                add_row(ls)

    return out


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def main() -> int:
    ap = argparse.ArgumentParser(description="Path-based cluster member enrichment (candidate outputs only).")
    ap.add_argument(
        "--markets-input",
        type=Path,
        default=_REPO / "data" / "markets" / "beauty_zone_members_enriched_with_presence_and_anchor.json",
    )
    ap.add_argument(
        "--anchor-input",
        type=Path,
        default=_REPO / "data" / "output" / "anchor_directories" / "anchor_directory_rows_combined.json",
        help="Optional; loaded for summary counts only in this version",
    )
    ap.add_argument("--output-dir", type=Path, default=_REPO / "data" / "output" / "path_enrichment")
    ap.add_argument("--timeout", type=float, default=22.0)
    ap.add_argument("--max-fetches", type=int, default=400)
    ap.add_argument("--max-candidates-per-member", type=int, default=14)
    ap.add_argument("--max-team-pages", type=int, default=4)
    ap.add_argument("--max-booking-links", type=int, default=1)
    ap.add_argument("--max-social-links", type=int, default=6)
    ap.add_argument("--limit-members", type=int, default=0, help="0 = all members")
    ap.add_argument("--insecure", action="store_true")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(levelname)s %(message)s")

    if not args.markets_input.is_file():
        LOG.error("markets file not found: %s", args.markets_input)
        return 1

    raw = load_json(args.markets_input)
    if isinstance(raw, dict) and "members" in raw:
        members = list(raw["members"])
    elif isinstance(raw, list):
        members = list(raw)
    else:
        LOG.error("markets JSON must be {members: [...]} or array")
        return 1

    assign_zone_clusters(members)
    if args.limit_members > 0:
        members = members[: args.limit_members]

    anchor_n = 0
    if args.anchor_input.is_file():
        aj = load_json(args.anchor_input)
        if isinstance(aj, dict) and "rows" in aj:
            anchor_n = len(aj.get("rows") or [])
        elif isinstance(aj, list):
            anchor_n = len(aj)

    fetch_budget = [args.max_fetches]
    candidates: list[dict[str, Any]] = []
    verify = not args.insecure
    headers = {"User-Agent": USER_AGENT}

    with httpx.Client(headers=headers, verify=verify) as client:
        for m in sorted(members, key=lambda x: str(x.get("location_id") or "")):
            if fetch_budget[0] <= 0:
                LOG.warning("max fetches reached; stopping early")
                break
            batch = process_member(
                m,
                members=members,
                client=client,
                timeout=args.timeout,
                max_team_pages=args.max_team_pages,
                max_booking_links=args.max_booking_links,
                max_social_links=args.max_social_links,
                fetch_budget=fetch_budget,
                max_cand_member=args.max_candidates_per_member,
            )
            candidates.extend(batch)

    out_dir = args.output_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    def ser_notes(c: dict[str, Any]) -> dict[str, Any]:
        o = dict(c)
        for k in ("path_match_notes", "extraction_notes"):
            v = o.get(k)
            if isinstance(v, list):
                o[k] = " | ".join(str(x) for x in v)
        return o

    (out_dir / "cluster_member_path_candidates.json").write_text(
        json.dumps({"candidates": candidates}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    with (out_dir / "cluster_member_path_candidates.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CANDIDATE_FIELDS, extrasaction="ignore")
        w.writeheader()
        for c in candidates:
            w.writerow({k: ser_notes(c).get(k) for k in CANDIDATE_FIELDS})

    matches = [c for c in candidates if c.get("path_confidence") == "high"]
    (out_dir / "cluster_member_path_matches.json").write_text(
        json.dumps({"matches": matches}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    by_type = Counter(str(c.get("path_source_type") or "") for c in candidates)
    by_conf = Counter(str(c.get("path_confidence") or "") for c in candidates)
    ig = sum(1 for c in candidates if (c.get("discovered_instagram_url") or "").strip())
    bk = sum(1 for c in candidates if (c.get("discovered_booking_provider") or "").strip())
    ph = sum(1 for c in candidates if (c.get("discovered_phone") or "").strip())
    domains = Counter(str(c.get("discovered_domain") or "") for c in candidates if c.get("discovered_domain"))

    summary = {
        "total_market_members_processed": len(members),
        "anchor_directory_rows_input_count": anchor_n,
        "total_candidates": len(candidates),
        "candidates_by_path_source_type": dict(sorted(by_type.items())),
        "candidates_by_confidence": dict(sorted(by_conf.items())),
        "rows_with_discovered_instagram_url": ig,
        "rows_with_discovered_booking_provider": bk,
        "rows_with_discovered_phone": ph,
        "distinct_discovered_domains": len(domains),
        "top_discovered_domains": dict(domains.most_common(20)),
        "fetches_remaining_budget": fetch_budget[0],
    }
    (out_dir / "cluster_member_path_summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print("path_enrich_cluster_members: done")
    print(f"  members processed: {len(members)}")
    print(f"  total candidates: {len(candidates)}")
    print(f"  by path_source_type: {summary['candidates_by_path_source_type']}")
    print(f"  by confidence: {summary['candidates_by_confidence']}")
    print(f"  discovered_instagram_url rows: {ig}")
    print(f"  discovered_booking_provider rows: {bk}")
    print(f"  discovered_phone rows: {ph}")
    print(f"  distinct domains: {summary['distinct_discovered_domains']}")
    print(f"  wrote: {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
