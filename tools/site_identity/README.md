# Site identity scraper + name resolver

Deterministic **shallow** fetch of salon websites, extraction of branding/identity signals, normalization, and **explainable** scoring against Google / DORA / internal names.

This is **not** a general crawler: max **8 pages per domain**, standard paths + footer links only.

## Install

From repo root:

```bash
cd tools/site_identity
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

Or use a global env with the same `pip install -r tools/site_identity/requirements.txt`.

## Run

```bash
python tools/site_identity_scraper.py ^
  --input data/input/salon_candidates.sample.json ^
  --output-dir data/output/site_identity ^
  --limit 100 ^
  --timeout 12
```

Flags:

| Flag | Meaning |
|------|---------|
| `--input` | JSON array or JSONL; or `{ "rows": [...] }` |
| `--output-dir` | Writes `enriched.json`, `review.csv`, `exceptions.json`, `exceptions.csv` |
| `--limit` | Process only first N rows (`0` = all) |
| `--timeout` | Per-request HTTP timeout (seconds) |
| `--max-pages` | Pages per domain (default 8) |
| `-v` | Verbose logging |
| `--insecure` | Skip TLS verification (use only if Python has no CA bundle / dev machines) |

On Windows/macOS, if HTTPS fails with `CERTIFICATE_VERIFY_FAILED`, install certs or run once with `--insecure` to confirm the pipeline.

## Input schema (flexible keys)

Each row may include:

| Field | Aliases |
|-------|---------|
| `id` | `ID` |
| Google name | `source_name_google`, `google_name`, `google` |
| DORA name | `source_name_dora`, `dora_name`, `dora` |
| Internal name | `source_name_internal`, `internal_name`, `internal` |
| Website | `website_url`, `url` |
| `phone` | |
| Address | `address` or built from `city`, `state`, `zip` |
| `lat`, `lon` | Reserved for future scoring |

Missing fields are OK.

## Output schema (main columns)

- `website_url_input`, `website_url_final`, `domain`
- `google_name`, `dora_name`, `internal_name`
- `best_site_name`, `best_site_name_norm`
- `match_label`: `strong_match` \| `probable_match` \| `weak_match` \| `ambiguous` \| `no_match`
- `total_score`, `score_name_similarity`, `score_address_bonus`, `score_phone_bonus`
- `evidence_summary`, `extracted_*`, `extracted_name_candidates` (with provenance)
- `fetch_status`, `fetch_error`, `notes`

**Exceptions** = rows where `match_label` is `ambiguous` or `no_match`.

## Scoring (see `lib/config.py`)

Weights: name (0.72) + phone bonus (0.14) + address bonus (0.14). Name similarity uses exact/containment + RapidFuzz token/partial + token Jaccard.

Thresholds (tunable in one place):

- `strong_match`: total ≥ 0.85 **and** phone or address corroboration (configurable)
- `probable_match`: ≥ 0.70
- `weak_match`: ≥ 0.55
- `ambiguous`: conflicting references or multiple close scores
- `no_match`: below weak threshold or no evidence

## Limitations

- No headless browser — JS-only sites may yield empty identity.
- `robots.txt` is consulted; unreachable robots → fetch allowed (common practice).
- Footer/nav heuristics may miss odd layouts.
- JSON-LD parsing is recursive but not a full schema validator.

## Files

| Path | Role |
|------|------|
| `tools/site_identity_scraper.py` | CLI entry |
| `tools/site_identity/cli.py` | Orchestration |
| `tools/site_identity/lib/config.py` | Thresholds & crawl limits |
| `tools/site_identity/lib/fetch.py` | HTTP + shallow URL queue |
| `tools/site_identity/lib/extract_identity.py` | HTML → signals + name candidates |
| `tools/site_identity/lib/normalize_name.py` | Normalization |
| `tools/site_identity/lib/score_match.py` | Resolution + evidence |
| `tools/site_identity/lib/output_writer.py` | JSON/CSV |
