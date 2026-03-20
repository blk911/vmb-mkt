"""
Business name normalization: preserve originals, emit full + reduced comparison forms.
Avoids over-aggressive collapsing; noise words only in reduced set.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from .config import NAME_NOISE_WORDS

_PUNCT_RE = re.compile(r"[^\w\s&]", re.UNICODE)
_SPACE_RE = re.compile(r"\s+")
_AMP_RE = re.compile(r"\s*&\s*")


@dataclass
class NormalizedName:
    original: str
    cleaned: str
    full_compare: str
    reduced_compare: str
    tokens_full: list[str]
    tokens_reduced: list[str]


def strip_accents(s: str) -> str:
    n = unicodedata.normalize("NFKD", s)
    return "".join(c for c in n if not unicodedata.combining(c))


def clean_visible_text(s: str, max_len: int = 400) -> str:
    if not s:
        return ""
    s = s.replace("\xa0", " ").strip()
    s = _SPACE_RE.sub(" ", s)
    return s[:max_len]


def normalize_for_compare_full(raw: str) -> str:
    """
    Lowercase, accent strip, punctuation stripped (keep alnum + spaces), & -> and.
    """
    if not raw:
        return ""
    s = strip_accents(raw.strip().lower())
    s = _AMP_RE.sub(" and ", s)
    s = s.replace("&", " and ")
    s = _PUNCT_RE.sub(" ", s)
    s = _SPACE_RE.sub(" ", s).strip()
    return s


def tokenize(s: str) -> list[str]:
    if not s:
        return []
    return [t for t in s.split() if t]


def reduced_tokens(tokens: list[str]) -> list[str]:
    """Drop common suffix noise; keep order."""
    out: list[str] = []
    for t in tokens:
        tl = t.lower().rstrip("s")  # soft singular for simple cases
        if tl in NAME_NOISE_WORDS or t.lower() in NAME_NOISE_WORDS:
            continue
        out.append(t)
    return out


def build_normalized_name(original: str) -> NormalizedName:
    cleaned = clean_visible_text(original, max_len=500)
    full = normalize_for_compare_full(cleaned)
    toks = tokenize(full)
    red_toks = reduced_tokens(toks)
    reduced_compare = " ".join(red_toks)
    return NormalizedName(
        original=original,
        cleaned=cleaned,
        full_compare=full,
        reduced_compare=reduced_compare,
        tokens_full=toks,
        tokens_reduced=red_toks,
    )


def phones_to_digits(phone: str | None) -> str:
    if not phone:
        return ""
    return re.sub(r"\D", "", phone)


def normalize_address_snippet(addr: str | None) -> str:
    if not addr:
        return ""
    s = strip_accents(addr.lower())
    s = _PUNCT_RE.sub(" ", s)
    s = _SPACE_RE.sub(" ", s).strip()
    return s
