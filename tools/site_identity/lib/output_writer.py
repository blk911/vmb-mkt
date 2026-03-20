"""
Write enriched JSON, reviewer CSV, and exceptions file.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd


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


def write_exceptions(path: Path, rows: list[dict[str, Any]], as_json: bool = True) -> None:
    ensure_dir(path.parent)
    if as_json:
        with path.open("w", encoding="utf-8") as f:
            json.dump(rows, f, indent=2, ensure_ascii=False)
    else:
        write_csv(path.with_suffix(".csv"), rows)
