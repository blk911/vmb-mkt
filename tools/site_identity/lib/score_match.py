"""
Explainable composite scoring: site names vs Google / DORA / internal references.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from rapidfuzz import fuzz

from . import config
from .extract_identity import NameCandidate
from .normalize_name import build_normalized_name, normalize_address_snippet, phones_to_digits


@dataclass
class ResolutionResult:
    match_label: str
    total_score: float
    score_name_similarity: float
    score_address_bonus: float
    score_phone_bonus: float
    best_site_name: str | None
    best_site_name_norm: str | None
    matched_against: str | None
    score_breakdown: dict[str, Any]
    evidence: list[str]
    ambiguous_reason: str | None


def _token_jaccard(a: str, b: str) -> float:
    sa, sb = set(a.split()), set(b.split())
    if not sa or not sb:
        return 0.0
    inter = len(sa & sb)
    union = len(sa | sb)
    return inter / union if union else 0.0


def compare_name_strings(site_norm: str, ref_raw: str) -> tuple[float, str]:
    if not ref_raw or not site_norm:
        return 0.0, "empty_reference"
    ref = build_normalized_name(ref_raw)
    r_full, s_full = ref.full_compare, site_norm
    r_red, s_red = ref.reduced_compare, build_normalized_name(site_norm).reduced_compare

    if s_full == r_full or (r_red and s_red and r_red == s_red):
        return 1.0, "exact_normalized"

    if r_full and (r_full in s_full or s_full in r_full):
        return 0.92, "containment_full"

    if r_red and (r_red in s_red or s_red in r_red):
        return 0.88, "containment_reduced"

    ratio = fuzz.token_set_ratio(s_full, r_full) / 100.0
    partial = fuzz.partial_ratio(s_full, r_full) / 100.0
    jacc = _token_jaccard(s_full, r_full)

    combo = max(ratio, 0.85 * partial + 0.15 * jacc)
    if combo < 0.4:
        combo = max(combo, jacc * 0.9)
    return min(1.0, combo), f"fuzzy_max(ratio={ratio:.2f},partial={partial:.2f},jacc={jacc:.2f})"


def _phone_match(input_phone: str | None, extracted: list[str]) -> tuple[float, list[str]]:
    if not input_phone:
        return 0.0, []
    d_in = phones_to_digits(input_phone)
    if len(d_in) < 10:
        return 0.0, []
    ev: list[str] = []
    for p in extracted:
        d = phones_to_digits(p)
        if len(d) >= 10 and (d_in[-10:] == d[-10:] or d_in in d or d in d_in):
            ev.append(f"Phone digits matched extracted value ({p})")
            return 1.0, ev
    return 0.0, []


def _address_match(input_addr: str | None, extracted: list[str]) -> tuple[float, list[str]]:
    if not input_addr:
        return 0.0, []
    ni = normalize_address_snippet(input_addr)
    if len(ni) < 8:
        return 0.0, []
    ev: list[str] = []
    best = 0.0
    for ex in extracted:
        ne = normalize_address_snippet(ex)
        if not ne:
            continue
        j = _token_jaccard(ni, ne)
        if j > best:
            best = j
        if j >= 0.55:
            ev.append(f"Address overlap with extracted snippet: {ex[:80]}")
    if best >= 0.55:
        return min(1.0, 0.6 + 0.4 * best), ev[:5]
    return 0.0, []


def resolve_row(
    google_name: str | None,
    dora_name: str | None,
    internal_name: str | None,
    phone: str | None,
    address: str | None,
    candidates: list[NameCandidate],
    extracted_phones: list[str],
    extracted_addresses: list[str],
    domain: str,
    *,
    instagram_handle: str | None = None,
    booking_provider: str | None = None,
) -> ResolutionResult:
    refs: list[tuple[str, str]] = []
    if google_name:
        refs.append(("google", google_name))
    if dora_name:
        refs.append(("dora", dora_name))
    if internal_name:
        refs.append(("internal", internal_name))

    evidence: list[str] = []

    if not candidates:
        return ResolutionResult(
            match_label=config.LABEL_NO_MATCH,
            total_score=0.0,
            score_name_similarity=0.0,
            score_address_bonus=0.0,
            score_phone_bonus=0.0,
            best_site_name=None,
            best_site_name_norm=None,
            matched_against=None,
            score_breakdown={"reason": "no_site_name_candidates"},
            evidence=["No extractable website name candidates (JS-only, blocked, or empty HTML)."],
            ambiguous_reason=None,
        )

    if not refs:
        evidence.append("No reference names (google/dora/internal) to compare.")
        if instagram_handle:
            evidence.append(f"Outbound Instagram handle on website: @{instagram_handle}")
        if booking_provider:
            evidence.append(f"Outbound booking provider on website: {booking_provider}")
        best_c = max(candidates, key=lambda x: (x.confidence_hint, -x.priority))
        return ResolutionResult(
            match_label=config.LABEL_NO_MATCH,
            total_score=0.0,
            score_name_similarity=0.0,
            score_address_bonus=0.0,
            score_phone_bonus=0.0,
            best_site_name=best_c.raw_text,
            best_site_name_norm=best_c.normalized_full,
            matched_against=None,
            score_breakdown={"note": "missing_reference_names"},
            evidence=evidence,
            ambiguous_reason=None,
        )

    all_pairs: list[tuple[float, NameCandidate, str, str, str]] = []
    for c in candidates:
        for label, ref in refs:
            sc, method = compare_name_strings(c.normalized_full, ref)
            all_pairs.append((sc, c, label, ref, method))

    best_pair = max(all_pairs, key=lambda x: x[0])
    top_sc, top_c, top_label, top_ref, top_method = best_pair

    pair_scores = sorted([p[0] for p in all_pairs], reverse=True)
    second_score = pair_scores[1] if len(pair_scores) > 1 else 0.0

    evidence.append(
        f"Best name pair ({top_method}): site “{top_c.raw_text[:120]}” vs {top_label} “{top_ref[:120]}” → {top_sc:.2f}"
    )

    if instagram_handle:
        ih = instagram_handle.lower().replace("_", "").replace(".", "")
        for _lbl, ref in refs:
            rl = re.sub(r"[^a-z0-9]", "", (ref or "").lower())
            if len(ih) >= 3 and (ih in rl or rl in ih):
                evidence.append(
                    f"Instagram handle @{instagram_handle} loosely overlaps reference name token — corroboration hint only."
                )
                break
        else:
            evidence.append(f"Outbound Instagram handle on website: @{instagram_handle}")
    if booking_provider:
        evidence.append(f"Outbound booking provider on website: {booking_provider}")

    phone_b, phone_ev = _phone_match(phone, extracted_phones)
    for e in phone_ev:
        evidence.append(e)
    addr_b, addr_ev = _address_match(address, extracted_addresses)
    for e in addr_ev:
        evidence.append(e)

    name_component = top_sc
    total = (
        config.WEIGHT_NAME_BEST * name_component
        + config.WEIGHT_PHONE_BONUS * phone_b * config.MAX_PHONE_BONUS
        + config.WEIGHT_ADDRESS_BONUS * addr_b * config.MAX_ADDRESS_BONUS
    )
    total = min(1.0, total)

    corroboration = phone_b > 0.5 or addr_b > 0.5

    ambiguous_reason: str | None = None

    # Conflicting reference names: two labels score high for the same top candidate
    ref_scores: dict[str, float] = {}
    for sc, c, lbl, _ref, _m in all_pairs:
        if c.normalized_full == top_c.normalized_full:
            ref_scores[lbl] = max(ref_scores.get(lbl, 0), sc)
    if len(ref_scores) >= 2:
        vals = sorted(ref_scores.values(), reverse=True)
        if len(vals) >= 2 and vals[0] - vals[1] < config.AMBIGUITY_MULTI_REF_GAP and vals[1] >= config.THRESHOLD_WEAK:
            ambiguous_reason = "Google vs DORA (or internal) both partially match site branding; primary reference unclear."
            evidence.append(ambiguous_reason)

    # Close runner-up score among all pairs
    if (
        ambiguous_reason is None
        and len(pair_scores) > 1
        and (top_sc - second_score) <= config.AMBIGUITY_SCORE_GAP
        and second_score >= config.THRESHOLD_WEAK
    ):
        ambiguous_reason = "Multiple site/reference combinations score within the ambiguity window."
        evidence.append(ambiguous_reason)

    label = config.LABEL_NO_MATCH
    if ambiguous_reason and top_sc >= config.THRESHOLD_WEAK:
        label = config.LABEL_AMBIGUOUS
    elif total >= config.THRESHOLD_STRONG and (not config.STRONG_REQUIRES_CORROBORATION or corroboration):
        label = config.LABEL_STRONG
    elif total >= config.THRESHOLD_STRONG and config.STRONG_REQUIRES_CORROBORATION and not corroboration:
        label = config.LABEL_PROBABLE
        evidence.append("High name score but no phone/address corroboration — not promoted to strong_match.")
    elif total >= config.THRESHOLD_PROBABLE:
        label = config.LABEL_PROBABLE
    elif total >= config.THRESHOLD_WEAK:
        label = config.LABEL_WEAK
    else:
        label = config.LABEL_NO_MATCH

    return ResolutionResult(
        match_label=label,
        total_score=round(total, 4),
        score_name_similarity=round(name_component, 4),
        score_address_bonus=round(addr_b, 4),
        score_phone_bonus=round(phone_b, 4),
        best_site_name=top_c.raw_text,
        best_site_name_norm=top_c.normalized_full,
        matched_against=top_label,
        score_breakdown={
            "name_vs_ref": {top_label: top_sc, "method": top_method},
            "second_best_name_score": round(second_score, 4),
            "weights": {
                "name": config.WEIGHT_NAME_BEST,
                "phone": config.WEIGHT_PHONE_BONUS,
                "address": config.WEIGHT_ADDRESS_BONUS,
            },
            "domain": domain,
        },
        evidence=evidence,
        ambiguous_reason=ambiguous_reason,
    )
