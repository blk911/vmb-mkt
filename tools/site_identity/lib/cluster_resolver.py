"""
Haversine clustering of enriched rows and cluster-level canonical name + review status.
"""

from __future__ import annotations

import math
from itertools import combinations
from typing import Any

from rapidfuzz import fuzz

from . import config
from .normalize_name import build_normalized_name

_EARTH_RADIUS_M = 6371000.0


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return _EARTH_RADIUS_M * c


def parse_float(value: Any) -> float | None:
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


def extract_point(row: dict[str, Any]) -> tuple[float, float] | None:
    lat = None
    lon = None
    for k in ("lat", "latitude"):
        if k in row:
            lat = parse_float(row.get(k))
            break
    for k in ("lon", "lng", "longitude"):
        if k in row:
            lon = parse_float(row.get(k))
            break
    if lat is None or lon is None:
        return None
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        return None
    return (lat, lon)


def _nonempty(v: Any) -> bool:
    if v is None:
        return False
    if isinstance(v, str):
        return bool(v.strip())
    return True


def _token_set_ratio(a: str, b: str) -> float:
    if not a or not b:
        return 100.0 if a == b else 0.0
    return float(fuzz.token_set_ratio(a, b))


def cluster_rows_by_distance(
    enriched: list[dict[str, Any]],
    threshold_meters: float,
) -> list[dict[str, Any]]:
    """
    Group rows with valid lat/lon into connected components when pairwise distance <= threshold.
    Returns one dict per cluster: cluster_id, rows, centroid_lat, centroid_lon, member_count.
    """
    indexed: list[tuple[int, tuple[float, float]]] = []
    for i, r in enumerate(enriched):
        pt = extract_point(r)
        if pt is not None:
            indexed.append((i, pt))
    n = len(indexed)
    if n == 0:
        return []
    adj: list[set[int]] = [set() for _ in range(n)]
    for a in range(n):
        ia, pa = indexed[a]
        for b in range(a + 1, n):
            ib, pb = indexed[b]
            if haversine_meters(pa[0], pa[1], pb[0], pb[1]) <= threshold_meters:
                adj[a].add(b)
                adj[b].add(a)
    seen = [False] * n
    clusters: list[list[int]] = []
    for s in range(n):
        if seen[s]:
            continue
        stack = [s]
        seen[s] = True
        comp: list[int] = []
        while stack:
            u = stack.pop()
            comp.append(u)
            for v in adj[u]:
                if not seen[v]:
                    seen[v] = True
                    stack.append(v)
        clusters.append(comp)
    clusters.sort(key=lambda c: min(indexed[i][0] for i in c))
    out: list[dict[str, Any]] = []
    for ci, comp in enumerate(clusters):
        idxs = sorted(indexed[i][0] for i in comp)
        cluster_rows = [enriched[i] for i in idxs]
        pts = [indexed[comp[j]][1] for j in range(len(comp))]
        clat = sum(p[0] for p in pts) / len(pts)
        clon = sum(p[1] for p in pts) / len(pts)
        cid = f"c{ci}"
        out.append(
            {
                "cluster_id": cid,
                "rows": cluster_rows,
                "centroid_lat": clat,
                "centroid_lon": clon,
                "member_count": len(cluster_rows),
            }
        )
    return out


def _collect_name_entries(rows: list[dict[str, Any]]) -> list[tuple[str, str, str]]:
    """(family, original, reduced_compare) for non-empty fields."""
    key_map = (
        ("google", "google_name"),
        ("dora", "dora_name"),
        ("internal", "internal_name"),
        ("website", "best_site_name"),
    )
    out: list[tuple[str, str, str]] = []
    for r in rows:
        for fam, k in key_map:
            v = r.get(k)
            if not _nonempty(v):
                continue
            s = str(v).strip()
            nn = build_normalized_name(s)
            red = nn.reduced_compare or nn.full_compare
            out.append((fam, s, red))
    return out


def _merge_similar_names(entries: list[tuple[str, str, str]]) -> list[list[tuple[str, str, str]]]:
    """Greedy merge: entries token_set_ratio >= CLUSTER_NAME_TOKEN_AGREE_MIN on reduced forms join one component."""
    if not entries:
        return []
    agree = float(config.CLUSTER_NAME_TOKEN_AGREE_MIN)
    comps: list[list[tuple[str, str, str]]] = []
    for e in entries:
        placed = False
        for comp in comps:
            ref = comp[0][2]
            if _token_set_ratio(ref, e[2]) >= agree:
                comp.append(e)
                placed = True
                break
        if not placed:
            comps.append([e])
    comps.sort(key=lambda c: (-len(c), c[0][2]))
    return comps


def _resolve_canonical_cluster_name(
    cluster_rows: list[dict[str, Any]],
) -> tuple[str | None, str | None, float, list[str]]:
    """
    Pick a canonical storefront string and a 0..1 resolution score from pooled row names.
    """
    entries = _collect_name_entries(cluster_rows)
    if not entries:
        return None, None, 0.0, []
    comps = _merge_similar_names(entries)
    best = comps[0]
    weight = {
        "google": 1.0,
        "dora": 0.95,
        "internal": 0.9,
        "website": 0.85,
    }
    best.sort(
        key=lambda e: (-len(e[1]), -weight.get(e[0], 0.5), e[1]),
    )
    chosen = best[0][1]
    nn = build_normalized_name(chosen)
    norm = nn.reduced_compare or nn.full_compare
    # Score: best fuzzy agreement between chosen and any pooled name in the winning component
    sims: list[float] = []
    for _, orig, red in best:
        sims.append(_token_set_ratio(norm, red) / 100.0)
    for _, orig, red in entries:
        sims.append(_token_set_ratio(norm, red) / 100.0)
    score = max(sims) if sims else 0.0
    ranked = sorted({e[1] for e in entries}, key=lambda s: (-len(s), s))
    return chosen, norm, float(score), ranked


def derive_cluster_name_conflict_flag(
    cluster_rows: list[dict[str, Any]],
    cluster_resolution_dict: dict[str, Any],
) -> bool:
    """
    True when source names disagree beyond harmless branding variants.
    Uses reduced_compare + token_set_ratio; suffix noise (spa, nails, etc.) already softened.
    """
    agree = float(config.CLUSTER_NAME_TOKEN_AGREE_MIN)
    entries = _collect_name_entries(cluster_rows)
    if len(entries) < 2:
        return False
    # Same-family multi-variant (different rows)
    by_fam: dict[str, list[str]] = {"google": [], "dora": [], "internal": [], "website": []}
    for fam, _orig, red in entries:
        by_fam.setdefault(fam, []).append(red)
    for fam, reds in by_fam.items():
        uniq = list(dict.fromkeys(reds))
        if len(uniq) < 2:
            continue
        for a, b in combinations(uniq, 2):
            if _token_set_ratio(a, b) < agree:
                return True
    # Cross-family: compare one representative per family (longest original per family)
    best_len: dict[str, int] = {}
    reps: dict[str, str] = {}
    for fam, orig, red in entries:
        L = len(orig)
        if fam not in best_len or L > best_len[fam]:
            best_len[fam] = L
            reps[fam] = red
    fam_keys = sorted(reps)
    for a, b in combinations(fam_keys, 2):
        if _token_set_ratio(reps[a], reps[b]) < agree:
            return True
    return False


def derive_cluster_review_status(
    cluster_resolution_dict: dict[str, Any],
    cluster_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    UI-oriented review tier + signal booleans (four families: google, dora, website, internal).
    """
    has_google = any(_nonempty(r.get("google_name")) for r in cluster_rows)
    has_dora = any(_nonempty(r.get("dora_name")) for r in cluster_rows)
    has_website = any(_nonempty(r.get("best_site_name")) for r in cluster_rows)
    has_internal = any(_nonempty(r.get("internal_name")) for r in cluster_rows)

    cluster_has_google_signal = has_google
    cluster_has_dora_signal = has_dora
    cluster_has_website_signal = has_website
    cluster_has_internal_signal = has_internal

    cluster_signal_count = sum(
        1 for x in (has_google, has_dora, has_website, has_internal) if x
    )

    score = float(cluster_resolution_dict.get("cluster_resolution_score") or 0.0)
    resolved = cluster_resolution_dict.get("cluster_resolved_name")
    resolved_ok = _nonempty(resolved)

    conflict = derive_cluster_name_conflict_flag(cluster_rows, cluster_resolution_dict)

    high_min = float(config.CLUSTER_CONFIDENCE_HIGH_MIN)
    med_min = float(config.CLUSTER_CONFIDENCE_MEDIUM_MIN)
    multi_req = bool(config.CLUSTER_REQUIRES_MULTI_SIGNAL_FOR_HIGH)

    if not resolved_ok:
        status = "unresolved"
    elif conflict:
        status = "review"
    elif score >= high_min:
        if multi_req and cluster_signal_count < 2:
            status = "likely"
        else:
            status = "confirmed"
    elif score >= med_min:
        status = "likely"
    elif cluster_signal_count > 0:
        status = "review"
    else:
        status = "unresolved"

    return {
        "cluster_review_status": status,
        "cluster_signal_count": cluster_signal_count,
        "cluster_has_google_signal": cluster_has_google_signal,
        "cluster_has_dora_signal": cluster_has_dora_signal,
        "cluster_has_website_signal": cluster_has_website_signal,
        "cluster_has_internal_signal": cluster_has_internal_signal,
        "cluster_name_conflict_flag": conflict,
    }


def summarize_cluster(cluster_rows: list[dict[str, Any]], cluster_id: str) -> dict[str, Any]:
    """One cluster summary row for JSON/CSV + merged review fields."""
    mids = [r.get("id") for r in cluster_rows]
    pts = [extract_point(r) for r in cluster_rows]
    pts_ok = [p for p in pts if p is not None]
    if pts_ok:
        clat = sum(p[0] for p in pts_ok) / len(pts_ok)
        clon = sum(p[1] for p in pts_ok) / len(pts_ok)
    else:
        clat = None
        clon = None

    name, norm, score, ranked = _resolve_canonical_cluster_name(cluster_rows)
    high_min = float(config.CLUSTER_CONFIDENCE_HIGH_MIN)
    med_min = float(config.CLUSTER_CONFIDENCE_MEDIUM_MIN)
    if score >= high_min:
        conf = "high"
    elif score >= med_min:
        conf = "medium"
    else:
        conf = "low"

    resolution: dict[str, Any] = {
        "cluster_id": cluster_id,
        "member_count": len(cluster_rows),
        "centroid_lat": clat,
        "centroid_lon": clon,
        "member_ids": mids,
        "cluster_resolved_name": name,
        "cluster_resolved_name_norm": norm,
        "cluster_resolution_score": score,
        "cluster_resolution_confidence": conf,
        "cluster_top_evidence": ranked[:12],
        "cluster_name_candidates_ranked": ranked,
    }

    resolution.update(derive_cluster_review_status(resolution, cluster_rows))

    distinct_booking_providers = sorted(
        {
            str(r.get("booking_provider")).strip()
            for r in cluster_rows
            if _nonempty(r.get("booking_provider"))
        }
    )
    instagram_count = sum(1 for r in cluster_rows if _nonempty(r.get("instagram_url")))
    resolution["distinct_booking_providers"] = distinct_booking_providers
    resolution["instagram_count"] = instagram_count
    return resolution


def apply_cluster_fields(
    enriched: list[dict[str, Any]],
    threshold_meters: float,
) -> list[dict[str, Any]]:
    """
    Mutate each enriched row with cluster_* fields; return cluster summary list (sorted by cluster_id).
    Rows without coordinates keep empty cluster_id and zeroed cluster fields.
    """
    for r in enriched:
        r["cluster_id"] = ""
        r["cluster_member_count"] = 0
        r["cluster_centroid_lat"] = None
        r["cluster_centroid_lon"] = None
        r["cluster_resolved_name"] = None
        r["cluster_resolution_confidence"] = ""
        r["cluster_review_status"] = ""
        r["cluster_signal_count"] = 0
        r["cluster_name_conflict_flag"] = False
        r["cluster_has_google_signal"] = False
        r["cluster_has_dora_signal"] = False
        r["cluster_has_website_signal"] = False
        r["cluster_has_internal_signal"] = False

    clusters = cluster_rows_by_distance(enriched, threshold_meters)
    summaries: list[dict[str, Any]] = []
    for cl in clusters:
        cid = cl["cluster_id"]
        mcount = cl["member_count"]
        cen_lat = cl["centroid_lat"]
        cen_lon = cl["centroid_lon"]
        summ = summarize_cluster(cl["rows"], cid)
        cr_name = summ.get("cluster_resolved_name")
        cr_conf = summ.get("cluster_resolution_confidence") or ""
        cr_status = summ.get("cluster_review_status") or ""
        cr_sig = int(summ.get("cluster_signal_count") or 0)
        cr_conflict = bool(summ.get("cluster_name_conflict_flag"))
        hg = bool(summ.get("cluster_has_google_signal"))
        hd = bool(summ.get("cluster_has_dora_signal"))
        hw = bool(summ.get("cluster_has_website_signal"))
        hi = bool(summ.get("cluster_has_internal_signal"))
        for row in cl["rows"]:
            row["cluster_id"] = cid
            row["cluster_member_count"] = mcount
            row["cluster_centroid_lat"] = cen_lat
            row["cluster_centroid_lon"] = cen_lon
            row["cluster_resolved_name"] = cr_name
            row["cluster_resolution_confidence"] = cr_conf
            row["cluster_review_status"] = cr_status
            row["cluster_signal_count"] = cr_sig
            row["cluster_name_conflict_flag"] = cr_conflict
            row["cluster_has_google_signal"] = hg
            row["cluster_has_dora_signal"] = hd
            row["cluster_has_website_signal"] = hw
            row["cluster_has_internal_signal"] = hi
        summaries.append(summ)

    summaries.sort(key=lambda s: str(s.get("cluster_id") or ""))
    return summaries
