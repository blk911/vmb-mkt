# HAIR CORPUS INVENTORY

**Repo:** `C:\dev\_vmb-mkt` (GitHub `blk911/vmb-mkt`)  
**Branch:** `research/hair-market-dig`  
**Dig date:** 2026-07-24  
**Status:** Evidence dig only — no VMB app / schema / production dataset changes.

## Repository snapshot (start of dig)

| Field | Value |
|---|---|
| Local path | `C:\dev\_vmb-mkt` |
| Working branch for dig | `research/hair-market-dig` (created from `main`) |
| Base SHA at branch creation | `882fc73a` (main tip at dig start) |
| Working tree | Pre-existing dirty generated runtime JSON and untracked `env/` / runtime fixtures — **not staged** for this dig |

## Hard finding (Phase 1)

The VMB marketing corpus has a usable **Hair identity / surface** set, but **committed service-menu and pricing text for Hair is essentially empty**.

`runtime-data/evidence_lake.v1.json` contains Hair-adjacent operator shells (e.g. Denver Hair Salon) with `extracted: {}`. Nails dominate `operator_master.v1.json` (~1703 nails vs ~25 `category: hair`, heavily duplicated).

Usable service/pricing language therefore required **live capture of corpus-attached booking URLs** (not outside market invention). Even then, many enrichment “booking” URLs are platform junk (`glossgenius.com/`, `vagaro.com/pro`, privacy pages).

---

## HAIR CORPUS INVENTORY (counts)

| # | Metric | Count | Notes |
|---|---|---:|---|
| 1 | Total probable Hair operators | **141** | Deduped `category=hair` + `barber` from beauty zone members (142 raw → 141) |
| 2 | Direct Hair specialists | **~120** | Zone `category=hair` |
| 3 | Multiservice salons with Hair | **Unknown from schema** | Zone is category-primary; multiservice not reliably labeled |
| 4 | Suite/container Hair tenants | **8 typed suite** + **~27 address/name suite-ish** | `subtype=suite` vs storefront 134 |
| 5 | Operators with websites (clean) | **1** | After junk-URL filter |
| 6 | Operators with booking profiles (clean) | **~9–14** | Many “booking” fields were platform marketing junk |
| 7 | Operators with Instagram (clean) | **~30** | After filtering platform IG handles |
| 8 | Operators with usable service evidence | **3** | Live menus: Perlino, The Place, Tulip’s |
| 9 | Operators with usable pricing evidence | **3** | Same three |
| 10 | Operators with quantity/modifier evidence | **2** | Length tiers (The Place); coverage tiers + row maintenance (Perlino) |
| 11 | Geographic distribution | Denver metro | Denver 102, Greenwood Village 15, Westminster 13, Thornton 7, others |
| 12 | Evidence-source distribution | See below | |
| 13 | Duplicate / low-confidence | **1** name+city dupe skipped; **~108** identity-only; **majority** booking URLs low-confidence junk |
| 14 | Exact files / datasets used | See below | |

### Evidence-source distribution

| Source | Role | Service/price yield |
|---|---|---|
| `data/markets/beauty_zone_members_enriched_full.json` | Primary identity + enrichment URLs | Identity yes / menus no |
| `runtime-data/operator_master.v1.json` | Master ops (nails-heavy) | ~25 hair rows, low unique value |
| `runtime-data/evidence_lake.v1.json` | Evidence shells | Empty `extracted` for Hair |
| `data/co/dora/.../HST_-_Hair_Stylist_-_All_Statuses.csv` | License density | Identity/geo only |
| Live fetches of corpus URLs | Menu capture | **3 operators usable** |
| Operator name signals in sample | Specialty balance | Low-confidence tags only |

### Exact files and datasets used

- `data/markets/beauty_zone_members_enriched_full.json`
- `runtime-data/operator_master.v1.json`
- `runtime-data/evidence_lake.v1.json`
- `data/co/dora/denver_metro/dora/dora_updt_031126/HST_-_Hair_Stylist_-_All_Statuses.csv` (presence check)
- `data/research/hair/hair_operator_sample.json` (derived)
- `data/research/hair/hair_corpus_counts.json` (derived)
- `data/research/hair/raw_fetches/*` (derived live HTML)
- `data/research/hair/browser_perlino.json` (derived browser extract)
- VMB app **read-only** reference: `lib/vmb/services/*` in `C:\dev\venmebaby-app-source` (Gel X gap matrix)

### Sample manifest

- Path: `data/research/hair/hair_operator_sample.json`
- Size: **90** operators (meets 75–100 preferred)
- Selection: score clean booking/website/IG + specialty name signals; top of deduped zone hair+barber
- Balance intent: suite, barber, color/extension/textured **name** signals included — **menus still sparse**

---

## Validation notes

- Keyword mentions alone were not counted as operators.
- Platform junk booking URLs were excluded from “usable booking” counts.
- Live menu operators are attached to their source URLs in observation JSON.
- **Unsupported assumption label:** Any taxonomy or pricing dimension not backed by ≥1 live menu operator (or clearly marked as name-signal only) is labeled **ASSUMPTION / DEFER**.
