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

### Install report (checklist)

| Step | Command / action |
|------|-------------------|
| **Python** | 3.10+ recommended (uses `httpx`, `pandas`, `rapidfuzz`). |
| **Create venv** | `cd tools/site_identity` → `python -m venv .venv` → activate (see above). |
| **Dependencies** | `pip install -r requirements.txt` (from `tools/site_identity` or path `tools/site_identity/requirements.txt` from repo root). |
| **Entry point** | From repo root: `python tools/site_identity_scraper.py --help` |
| **Verify** | Smoke: `python tools/site_identity_scraper.py --input data/input/salon_candidates.sample.json --output-dir data/output/site_identity_smoke --limit 5 --timeout 12` → expect `enriched.json`, `run_summary.json`. |
| **TLS issues** | If `CERTIFICATE_VERIFY_FAILED`, fix CA bundle or use `--insecure` once for local smoke only. |

**Storefront + DORA fusion** (optional): requires default data files under repo root — `data/markets/shop_anchor_map.v1.json`, `data/markets/beauty_zone_members.json` — and flag `--dora-enrich` (see Run table). Override paths with `--dora-anchor-map` / `--dora-zone-members`; radius with `--dora-max-meters` (default 75).

### Site Identity Merge (`merge_into_markets.py`)

**Purpose:** Copy **social / booking** fields from a site_identity **`enriched.json`** into **`beauty_zone_members_enriched.json`** without changing the original file, so the Next.js Markets UI can read optional presence fields from a merged dataset.

**Match logic (deterministic, one site_identity row per market row at most):** iterate market members in file order; for each, try in order — **strong:** same `build_normalized_name` full_compare as site row display name (`google_name` → `best_site_name` → `dora_name`) and Haversine distance ≤ 75 m (both sides need lat/lon); **medium:** RapidFuzz token-set ratio ≥ 0.8 on those normalized strings and distance ≤ 75 m; **fallback:** exactly one remaining site_identity row within 30 m. First successful match wins; matched site rows are removed from the pool.

**Output:** `data/markets/beauty_zone_members_enriched_with_presence.json` by default (same top-level shape as input: `{ "members": [...], ... }` or a bare array if the source was an array). Adds `site_identity_matched`, `site_identity_match_type`, `site_identity_match_distance_m` on each member row.

**UI:** Point `loadZoneMembers` / deployment at the **with_presence** file (e.g. rename or symlink to replace `beauty_zone_members_enriched.json`, or adjust the path in your ingest). The schema is unchanged aside from optional new keys.

```bash
python tools/site_identity/merge_into_markets.py ^
  --site-identity-input data/output/site_identity_storefront_dora/run_250/enriched.json ^
  --output data/markets/beauty_zone_members_enriched_with_presence.json
```

### Anchor directory ingestion (`ingest_anchor_directories.py`)

**What:** Some anchor brands publish **suite / tenant directories** (curated rosters with profiles, Instagram, booking links). This is a **separate shallow ingest** from the storefront site_identity scraper: it fetches **seed URLs only** (plus a small same-domain expansion for Sola), parses **static HTML**, normalizes fields, and writes JSON/CSV under `data/output/anchor_directories/`. It does **not** call external APIs, log in, or run a headless browser.

**Phase 1 anchors:** **Modern SalonStudios** (WordPress-style `/project/…` listings from a directory index such as `/beautypros/`) and **Sola Salons** (heuristics for Instagram / booking blocks + optional path-based extra pages). Many Sola marketing pages are **JS-heavy**; if the seed returns no tenant-level links in HTML, you will get **zero Sola rows** until you supply a seed URL whose HTML actually contains per-professional links.

**Outputs:** `modern_directory_rows.json`, `sola_directory_rows.json`, `anchor_directory_rows_combined.json`, CSV mirrors, and `anchor_directory_summary.json` (counts). Each row includes `source_type: "anchor_directory"`, `source_confidence: "high"`, and provenance fields (`anchor_directory_url`, `tenant_profile_url`, `extraction_notes`). Missing fields stay empty.

**Caveats:** Directory snapshots reflect **what the HTML exposes at fetch time** (not guaranteed “current tenants”). Do not treat as legal tenancy proof. **Merge into markets** is a future step; this patch only produces standalone artifacts ready for matching.

```bash
python tools/site_identity/ingest_anchor_directories.py ^
  --modern-url https://modernsalonstudios.com/beautypros/ ^
  --sola-url https://www.solasalonstudios.com/locations ^
  --output-dir data/output/anchor_directories
```

Use `--max-profile-pages` to cap Modern project fetches and Sola output rows; `--max-extra-pages` limits Sola same-domain listing fetches. `--insecure` only if TLS verification fails locally.

### Anchor directory → markets merge (`merge_anchor_directory_into_markets.py`)

**Purpose:** Add a **conservative supplemental layer** from `data/output/anchor_directories/anchor_directory_rows_combined.json` onto **`beauty_zone_members_enriched_with_presence.json`**, without overwriting existing **site_identity** fields (`instagram_url`, `booking_provider`, etc.). New fields are prefixed with `anchor_directory_*` (e.g. `anchor_directory_instagram_url`).

**Matching (deterministic, tight):**
- **Strong:** tenant name equals or near-exact (token-set ratio ≥ 0.95) **and** (**location/context overlap** between zone/market/city/address and `anchor_cluster_hint`, **or** Haversine ≤ 75 m when **both** market and anchor row have lat/lon).
- **Supported:** token-set ratio ≥ 0.88 **and** same context rule **and** anchor row has at least one Instagram/ booking signal **and** corroborating presence on the anchor row.

No loose global fuzzy pool; each anchor row is consumed at most once. Processing order: market members in file order; anchor candidates sorted by `tenant_profile_url`.

**Output:** `data/markets/beauty_zone_members_enriched_with_presence_and_anchor.json`. The Next.js loader prefers this file when present (`resolveZoneMembersJsonPath`).

```bash
python tools/site_identity/merge_anchor_directory_into_markets.py ^
  --markets-input data/markets/beauty_zone_members_enriched_with_presence.json ^
  --anchor-input data/output/anchor_directories/anchor_directory_rows_combined.json ^
  --output data/markets/beauty_zone_members_enriched_with_presence_and_anchor.json
```

### Path-based enrichment for cluster members (`path_enrich_cluster_members.py`)

**What:** A **cluster-assisted, path-based** layer that uses **known** contexts (official site domain, booking URL, anchor profile URL, Instagram) to **shallowly** fetch a small set of pages and emit **structured candidate rows** for review — **not** a redesign of site_identity, **no** external APIs, **no** search engines, **no** open-web crawling.

**Supported path types (`path_source_type`):**

| Type | Meaning |
|------|---------|
| `official_team_page` | Same-brand domain links that look like team/staff/member pages (`/team`, `/beautypros`, profile-like slugs), capped per member. |
| `booking_profile` | Follows **only** links under the **same booking host** as the member’s known booking URL, limited to paths that look like staff/team/services (e.g. merchant-scoped Vagaro/GlossGenius/Square paths). |
| `anchor_profile` | `anchor_directory_profile_url` fetched for supplemental signals. |
| `linked_social` / `linked_contact` | Outbound links on fetched pages classified as social/booking/contact (reuses outbound classification; no social “crawling”). |

**Why conservative:** Deterministic URL ordering, **hard caps** on fetches per run/member, **same-domain** (or same booking merchant) rules, **no** login/headless automation by default, **no** overwriting `beauty_zone_members_*` — outputs are standalone JSON/CSV for later merge.

**Outputs** (default `data/output/path_enrichment/`): `cluster_member_path_candidates.json`, `cluster_member_path_candidates.csv`, `cluster_member_path_summary.json`, and `cluster_member_path_matches.json` (high-confidence subset).

```bash
python tools/site_identity/path_enrich_cluster_members.py ^
  --markets-input data/markets/beauty_zone_members_enriched_with_presence_and_anchor.json ^
  --output-dir data/output/path_enrichment ^
  --max-fetches 200 ^
  --insecure
```

Optional: `--anchor-directory-json data/output/anchor_directories/anchor_directory_rows_combined.json` (for summary input counts), `--limit-members N`, `--max-booking-links K`.

### Path enrichment → markets merge (`merge_path_enrichment_into_markets.py`)

**Purpose:** Copy **only safe** path-enrichment signals into the zone-members JSON as **`path_enrichment_*` supplemental fields** — never overwriting core `instagram_url`, `booking_provider`, `website_url`, `phone`, or other site_identity fields. Produces **`data/markets/beauty_zone_members_enriched_full.json`**. The Next.js loader prefers this file when present (`resolveZoneMembersJsonPath`).

**Conservative merge rules:**

| Rule | Behavior |
|------|----------|
| Auto-merge | `path_confidence == high`, **or** `medium` with corroboration (IG/booking/domain vs member, or strong name alignment on official/booking paths, or parent-brand/zone hint). |
| Skip | `low`; `medium` without corroboration; multiple safe candidates that **conflict** on non-empty IG handle, booking provider, or phone. |
| Best row | Deterministic sort: confidence → `path_source_type` priority → `discovered_url`; `path_enrichment_match_count` counts all non-conflicting safe candidates. |

**Outputs:** `beauty_zone_members_enriched_full.json`; optional review file `data/output/path_enrichment/path_candidates_holdout.json` (non-merged medium/low, conflicts, and `not_winner` alternates).

```bash
python tools/site_identity/merge_path_enrichment_into_markets.py ^
  --markets-input data/markets/beauty_zone_members_enriched_with_presence_and_anchor.json ^
  --candidates-input data/output/path_enrichment/cluster_member_path_candidates.json ^
  --output data/markets/beauty_zone_members_enriched_full.json ^
  --holdout-output data/output/path_enrichment/path_candidates_holdout.json
```

### Gray pin resolver (query generation + scoring)

**Purpose:** Turn **gray** market members (no Instagram/booking on the member row, not anchor, no `path_enrichment_matched`) into **actionable search queries** for identity recovery — then **score** structured candidates before merge.

**Library:** `lib/gray_pin_resolver.py`

| Function | Role |
|----------|------|
| `member_is_gray_pin(row)` | Same semantics as the admin map “gray / low signal” pin. |
| `build_gray_resolution_queries(name, address, city, state, category)` | Exact geo, category, address-first, platform `site:` probes, partial-name fallbacks. |
| `build_address_instagram_probe(address, city?, state?)` | Bonus: `{address city state} instagram` for tagged/geo discovery. |
| `score_candidate_against_member(member, candidate)` | Returns `(score, detail)` using additive rules: name >0.8 → +3, address match +3, geo ≤0.1 mi +2, IG/booking found +3, suite/building +2. **Tier:** ≥7 `auto`, 4–6 `review`, &lt;4 `discard`. |
| `compute_gray_resolution_score(...)` / `classify_resolution_tier(score)` | Lower-level scoring if you already have booleans. |

**No search API in-repo:** run queries via your search tool, then pass each hit dict into `score_candidate_against_member` (expects optional keys: `discovered_name` / `title`, `formatted_address`, `lat`/`lng`, `instagram_url`, `booking_url`, `suite_match`).

**CLI:** emit JSONL of queries per gray member (optional `--zone-id`, `--limit`):

```bash
cd tools/site_identity
python gray_pin_emit_queries.py ^
  --markets-input ../../data/markets/beauty_zone_members_enriched_full.json ^
  --output ../../data/output/gray_pin/gray_resolution_queries.jsonl ^
  --limit 50
```

### Updates (March 2026)

- **Storefront → DORA pre-step:** `--dora-enrich` joins `places_candidates`-style rows to DORA shop names via nearest `beauty_zone_members` (within `--dora-max-meters`) → `shop_anchor_map` by `google_location_id`. Adds `source_name_dora` / match metadata used by clustering and scoring (no redesign of score weights).
- **Reference runs** (Denver metro `places_candidates.v1.json`, same CLI flags except `--limit`): `data/output/site_identity_storefront_dora/run_50/` and `run_250/`. Example `run_250` summary: `rows_with_dora_signal` 71 / 250; `cluster_review_status_counts` confirmed 52, likely 39, review 77; `rows_fetch_ok` 183, `rows_fetch_failed` 67.

### Input row adapter (`lib/row_adapter.py`)

Real VMB / DORA / Google exports use inconsistent column names. **`adapt_input_rows`** runs immediately after load (and after `--limit`): it **merges** each raw dict with **canonical** fields so the rest of the pipeline only reads one shape. **Original keys are kept** on the row; canonical values are **overlaid** using **first non-empty wins** in a fixed alias order. Rows are tagged with **`_adapter_applied: true`**. No large duplicate blobs.

**Canonical schema (targets):** `id`, `source_name_google`, `source_name_dora`, `source_name_internal`, `website_url`, `phone`, `address`, `city`, `state`, `zip`, `lat`, `lon`.

**Aliases (same order as in code):**

| Target | Aliases |
|--------|---------|
| `id` | `id`, `place_id`, `facility_id`, `license_id`, `row_id` |
| `source_name_google` | `source_name_google`, `google_name`, `google_business_name`, `business_name_google` |
| `source_name_dora` | `source_name_dora`, `dora_name`, `facility_name`, `legal_name`, `business_name_dora` |
| `source_name_internal` | `source_name_internal`, `internal_name`, `business_name`, `name` |
| `website_url` | `website_url`, `website`, `url`, `domain_url` |
| `phone` | `phone`, `phone_number`, `formatted_phone`, `business_phone` |
| `address` | `address`, `street_address`, `address_line_1`, `full_address` |
| `city` | `city` |
| `state` | `state` |
| `zip` | `zip`, `zipcode`, `postal_code` |
| `lat` | `lat`, `latitude` |
| `lon` | `lon`, `lng`, `longitude` |

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
| `--input` | JSON array, JSONL, `{ "rows": [...] }`, or `{ "members": [...] }` (e.g. zone members export). `beauty_live_units.v1.json`-style rows with `raw_snippets`, and `places_candidates.v1.json`-style rows with nested `candidate` (Places storefront), are auto-flattened in `cli.py` before `row_adapter`. |
| `--output-dir` | Main outputs, reviewer exception CSVs, `run_summary.json` / `run_summary.txt` (see below) |
| `--limit` | Process only first N rows (`0` = all) |
| `--timeout` | Per-request HTTP timeout (seconds) |
| `--max-pages` | Pages per domain (default 8) |
| `-v` | Verbose logging |
| `--insecure` | Skip TLS verification (use only if Python has no CA bundle / dev machines) |
| `--cluster-threshold-meters` | Max Haversine distance (m) to group rows with valid lat/lon into one cluster (`config.DEFAULT_CLUSTER_THRESHOLD_METERS`) |
| `--dora-enrich` | After load/limit, join Places rows to DORA **shop** names: nearest `beauty_zone_members` (≤ `--dora-max-meters`) → `shop_anchor_map` by `google_location_id` (`lib/storefront_dora_enricher.py`). Optional paths: `--dora-anchor-map`, `--dora-zone-members`. |

On Windows/macOS, if HTTPS fails with `CERTIFICATE_VERIFY_FAILED`, install certs or run once with `--insecure` to confirm the pipeline.

### Social & booking signals (outbound links only)

From **already-fetched** HTML pages (same shallow crawl as identity), the extractor scans `<a href>` links, resolves them to absolute `http(s)` URLs, and classifies **outbound** social and booking URLs. **No** requests are made to Instagram, Facebook, booking APIs, or third-party sites beyond the salon website crawl — this is link extraction + host/path matching only.

**Per-row fields (when present):** `instagram_url`, `instagram_handle` (derived from profile-style Instagram URLs), `facebook_url`, `tiktok_url`, `yelp_url`, `linktree_url`, `booking_url`, `booking_provider`.

**Booking providers detected (host/path):** vagaro, glossgenius, square (squareup.com / square.site / square.app), booksy, fresha, acuityscheduling, schedulicity, styleseat, boulevard (joinblvd.com / boulevard.com), mindbody (mindbodyonline.com / mindbody.com), phorest.

**Merge rules:** Contact-style paths (`/contact`, `/contact-us`, …) and links in `<footer>` / `<header>` / `<nav>` are preferred over generic body; first strong field win per URL type across pages in fetch order.

**Cluster summary (extra):** `distinct_booking_providers`, `instagram_count` (members with `instagram_url`).

**Run summary (extra):** `rows_with_instagram`, `rows_with_booking`, `booking_provider_counts`.

Scoring adds **evidence lines** only (e.g. outbound Instagram handle / booking provider; optional loose overlap hint vs reference names) — composite numeric weights unchanged.

### Physical clustering & cluster review status

Rows with valid **lat/lon** are grouped by distance (`cluster_rows_by_distance`). Outputs include **`cluster_summary.json`** / **`cluster_summary.csv`** plus per-row cluster columns on **`enriched.json`** / **`review.csv`**.

**Signal families (count = `cluster_signal_count`, max 4):** a cluster has **google** if any member has `google_name`; **dora** if any has `dora_name`; **website** if any has `best_site_name`; **internal** if any has `internal_name`. Booleans: `cluster_has_google_signal`, `cluster_has_dora_signal`, `cluster_has_website_signal`, `cluster_has_internal_signal`.

**`cluster_review_status`** (UI mapping, one of):

| Value | Meaning |
|-------|---------|
| `confirmed` | `cluster_resolution_score` ≥ `CLUSTER_CONFIDENCE_HIGH_MIN` (0.85), and if `CLUSTER_REQUIRES_MULTI_SIGNAL_FOR_HIGH` then at least **two** distinct signal families; `cluster_name_conflict_flag` is false |
| `likely` | Score ≥ `CLUSTER_CONFIDENCE_MEDIUM_MIN` (0.65) but not enough for `confirmed` (e.g. only one signal when multi-signal required for high tier) |
| `review` | Conflicting source names, weak score, or `cluster_name_conflict_flag` |
| `unresolved` | No usable resolved cluster name or no identity signals |

**`cluster_name_conflict_flag`:** set when two non-empty names (same or different family) look like **different identities** after normalization — pairwise `token_set_ratio` on reduced compare forms must be ≥ `CLUSTER_NAME_TOKEN_AGREE_MIN` (default 88) to count as agreement. Harmless variants (e.g. “Paris Nails” vs “Paris Nails & Spa”) usually share a high ratio after noise-word reduction.

Rows **without** coordinates are not clustered; cluster id and review fields stay empty / false / zero as applicable.

### Reviewer exception CSVs

Deterministic splits for triage (fixed columns in `cli.py` — `EXCEPTION_REVIEW_COLUMNS`). Rows are sorted by `id`, then `cluster_id`.

| File | Purpose |
|------|---------|
| `exceptions_missing_coords.csv` | Rows where **`extract_point`** returns no valid lat/lon (missing, non-numeric, or out of range). Same rule as clustering eligibility. |
| `exceptions_unresolved.csv` | Rows matching **any** of: `cluster_review_status == unresolved`; `match_label == no_match`; **no** `best_site_name` and **no** non-empty `google_name` / `dora_name` / `internal_name`; **or** empty `cluster_id` and **weak identity evidence** (`match_label` weak/ambiguous/no_match, or `total_score` &lt; `THRESHOLD_PROBABLE`, or no site name and no strong source names). |
| `exceptions_fetch_issues.csv` | Rows with `fetch_status` other than `ok`, **or** non-empty `fetch_error`, **or** `domain` on a small reserved/placeholder list (`example.com` / `example.org` / `example.net` and `*.example.com` / `*.example.org`), **or** notes indicating no URL / skipped fetch. No aggressive parked-domain detection. |
| `isolated_clusters_review.csv` | **Cluster-level** (one row per cluster): `member_count == 1` and `cluster_review_status` in `review` \| `unresolved`. `notes` holds `cluster_top_evidence` text. |

**Exceptions** (legacy) = rows where `match_label` is `ambiguous` or `no_match` → still written to `exceptions.json` / `exceptions.csv`.

### Run summary (`run_summary.json` / `run_summary.txt`)

After each run, **`run_summary.json`** records batch QA metrics (sorted keys) so you can assess a job without opening every CSV. **`run_summary.txt`** repeats the same figures in a fixed line order.

Includes at least: `input_row_count`, `processed_row_count`, `rows_with_valid_coords` / `rows_missing_coords` (via `extract_point`), `rows_fetch_ok` / `rows_fetch_failed` (non-`ok` status or any `fetch_error`), `rows_with_best_site_name`, `match_label_counts`, `cluster_count`, `cluster_size_distribution` (member count → number of clusters), `cluster_review_status_counts` (**from `cluster_summary` rows**), `unresolved_row_count` (row `cluster_review_status == unresolved` **or** `match_label == no_match`), `unresolved_cluster_count`, plus optional signal counts, `exception_file_counts`, `isolated_cluster_review_count`, and `exception_files` (names). The CLI prints a short block to stdout with the same high-level numbers.

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
| `lat`, `lon` (or `latitude` / `longitude` / `lng`) | Used for clustering; echoed on enriched output |

Missing fields are OK.

## Output schema (main columns)

- `website_url_input`, `website_url_final`, `domain`
- `google_name`, `dora_name`, `internal_name`
- `best_site_name`, `best_site_name_norm`
- `match_label`: `strong_match` \| `probable_match` \| `weak_match` \| `ambiguous` \| `no_match`
- `total_score`, `score_name_similarity`, `score_address_bonus`, `score_phone_bonus`
- `evidence_summary`, `extracted_*`, `extracted_name_candidates` (with provenance)
- Social / booking (from outbound links on fetched pages): `instagram_url`, `instagram_handle`, `facebook_url`, `tiktok_url`, `yelp_url`, `linktree_url`, `booking_url`, `booking_provider`
- `fetch_status`, `fetch_error`, `notes`
- Cluster: `cluster_id`, `cluster_member_count`, `cluster_centroid_lat`, `cluster_centroid_lon`, `cluster_resolved_name`, `cluster_resolution_confidence`, `cluster_review_status`, `cluster_signal_count`, `cluster_name_conflict_flag`, `cluster_has_google_signal`, `cluster_has_dora_signal`, `cluster_has_website_signal`, `cluster_has_internal_signal`, plus `lat` / `lon`

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
| `tools/site_identity/lib/output_writer.py` | JSON/CSV + `write_csv_with_columns` + `build_run_summary` |
| `tools/site_identity/lib/cluster_resolver.py` | Haversine clustering, canonical name, `derive_cluster_review_status` |
| `tools/site_identity/lib/row_adapter.py` | Normalize mixed input keys → canonical fields before `process_one` |
| `tools/site_identity/lib/storefront_dora_enricher.py` | Optional `--dora-enrich`: geo join Places → zone members → shop anchor (DORA shop name) |
| `tools/site_identity/merge_into_markets.py` | Merge `enriched.json` presence fields into `beauty_zone_members_enriched.json` → `beauty_zone_members_enriched_with_presence.json` |
| `tools/site_identity/ingest_anchor_directories.py` | CLI: anchor brand directory ingest → `data/output/anchor_directories/*.json` |
| `tools/site_identity/lib/anchor_directory_extract.py` | Fetch + HTML extract (Modern / Sola) |
| `tools/site_identity/lib/anchor_directory_normalize.py` | Normalize names, handles, booking provider (mirrors `extract_identity` rules) |
| `tools/site_identity/merge_anchor_directory_into_markets.py` | Merge `anchor_directory_rows_combined.json` → supplemental `anchor_directory_*` fields on zone members |
| `tools/site_identity/path_enrich_cluster_members.py` | Cluster path-based enrichment → `data/output/path_enrichment/*` (candidates for review, no markets overwrite) |
| `tools/site_identity/lib/path_enrichment_extract.py` | Team/booking/social link helpers for path enricher |
| `tools/site_identity/lib/path_enrichment_normalize.py` | Normalize discovered names/domains for path candidates |
| `tools/site_identity/merge_path_enrichment_into_markets.py` | Merge safe path candidates → `path_enrichment_*` on `beauty_zone_members_enriched_full.json` |
