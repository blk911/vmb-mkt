#!/usr/bin/env python3
"""
Site identity scraper CLI — run from repo root:
  python tools/site_identity_scraper.py --input data/input/salon_candidates.sample.json --output-dir data/output/site_identity --limit 5
"""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent / "site_identity"
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from cli import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())
