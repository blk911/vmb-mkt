# HAIR PRICING DIMENSIONS

Evidence from live menus: **Perlino**, **The Place**, **Tulip’s**. Dimensions without multi-operator support are marked **LOW_N** or **NOT_OBSERVED**.

## Dimension catalog

| Factor | Class | Market language (exact) | Client-visible? | Operators | Count |
|---|---|---|---|---|---:|
| Base service price | BASE | Fixed `$75.00` (Tulip); “Starting at $55.00” (Perlino) | Yes | 3 | 3 |
| Length short/medium/long | TIER | `SHORT` / `MEDIUM` / `LONG` next to prices | Yes | The Place | 1 |
| Coverage mini/partial/full | TIER | Mini / Partial / Full Custom Color; Partial/Full Highlight | Yes | Perlino, The Place, Tulip | 3 |
| Extra-full density (extensions) | TIER | Partial / Full / Extra Full install | Yes (as SKU) | Perlino | 1 |
| Finish: haircut vs blowdry | FIXED_OPTION / package variant | `+ Haircut` vs `+ Blowdry` | Yes | Perlino | 1 |
| Gloss/toner/glaze | BASE or ADD_ON | “Glaze, Gloss, Toner (same thing)”; Tulip “Haircut and Gloss” | Yes | Perlino, Tulip | 2 |
| Product brand tier (treatment) | FIXED_OPTION | “Davines starts at $15”, “K18 $25”, “Kerastase $38”, “Olaplex $50” | Yes | Perlino | 1 |
| Extension row maintenance | QUANTITY | “1 row maintenance”, “2 row maintenance” | Yes as SKU choice | Perlino | 1 |
| Add-on curls / scalp / beard | ADD_ON | “Add-on curls $10”, “Add-on Scalp Treament $20”, “Beard Trim $20” | Yes | Tulip | 1 |
| Consultation gate | CONSULTATION | “A consultation required to book this service”; `$0` / `$5` consult | Yes (as gate) | Perlino, The Place | 2 |
| Starting-at pricing | — (mode) | “Starting at $220.00”, “Starting price point $325” | Yes | Perlino | 1 |
| Free / existing-client | MARKET_LANGUAGE | “Free for existing clients only” (bang trim) | Disclosure | The Place | 1 |
| Color adjustment $0 | CONSULTATION / quote | “Color Adjustment $0.00” | Soft | Tulip | 1 |
| Extra bowl / ounce / tube | QUANTITY | — | — | — | **0 NOT_OBSERVED** |
| Thick-hair / density surcharge | TIME_MODIFIER | — | — | — | **0 NOT_OBSERVED** |
| Stylist level junior/senior | STYLIST_LEVEL | — | — | — | **0 NOT_OBSERVED** |
| Per-foil count | TECHNIQUE_MODIFIER | Implied via partial/full only | — | — | **0 explicit** |

## Quantity / unit pricing

| Unit | Services | Frequency | First unit included? | Additional pattern | Who selects | Public? |
|---|---|---|---|---|---|---|
| Length tier (S/M/L) | Cuts, color combos | High within The Place menu | N/A (choose tier) | Price steps by length | **CLIENT-SELECTABLE** | Yes |
| Coverage tier | Color/highlight/custom | High across 3 menus | Base = chosen tier | Separate SKUs | **CLIENT-SELECTABLE** | Yes |
| Row | Extension maintenance | Low (Perlino) | 1-row SKU vs 2-row SKU | Separate SKUs | Client picks SKU; stylist may advise | Yes as SKUs |
| Weft / install density | Extension install | Low (Perlino) | — | Partial/Full/Extra Full | Consult → stylist | Consult-gated |
| Ounce / bowl / tube | — | **0** | — | — | Would be **STYLIST-DETERMINED** if seen | Defer |
| Hour / 15-min | Durations listed | Common as duration, not price unit | — | Duration rises with length tier | Mixed | Duration yes |

**Critical distinction confirmed:** Do **not** expose ounce/bowl as client dropdown without evidence. Length and coverage tiers **are** client-selectable in captured menus.

## Pricing modes (Phase 8)

| Mode | Operator count (live) | Examples | Evidence strength | Gel X supports? | Missing primitive? |
|---|---:|---|---|---|---|
| fixed | 2 (Tulip, Place mens/simple) | Mens Haircut $65; Color Retouch $120 | High | Yes | No |
| starting_at | 1 (Perlino dominant) | Starting at $220 Full Custom Color | High for that salon | **No** (fixed cents only) | **pricingMode + display** |
| range | 0 explicit “$A–$B” | — | — | No | Defer |
| tiered | 1 (The Place) | SHORT/MED/LONG | High for that salon | Partial via mutually exclusive addons | Prefer first-class **tier option group** |
| per_unit | 1 (row maintenance) | 1 vs 2 row | Medium | Partial (quantity addon) | Optional `unitLabel` |
| hourly | 0 as price | Duration only | — | Duration yes | No |
| consultation_required | 2 | Extensions; color consult | High | **No** | `consultationRequired` |
| quote_after_assessment | 1 soft | Color Adjustment $0 | Low | No | Fold into consultation |
| deposit_only | 0 | — | — | No | Defer |

## Duration modifiers (Phase 9)

| Pattern | Evidence | Shared model need |
|---|---|---|
| Fixed duration | Place mens 30min; bangs 15min | `base duration` (exists) |
| Duration rises with length tier | Place highlight SHORT 2h → LONG 2h45 | `option duration delta` or tier duration map |
| Processing variance | Not numerically captured | Defer |
| Extension install duration | Not priced/timed in extract | Consult-only |
| Consultation duration | Consult SKUs $0/$5 | Separate consult service |

**Required:** base duration + per-option/tier duration delta.  
**Not proven:** duration range as first-class client field; stylist-confirmed duration flag (useful but **ASSUMPTION** until more evidence).

## Admin / Salon / Client (Phase 10)

| Dimension | ADMIN DEFAULT | SALON VALIDATION | CLIENT DISPLAY | INTERNAL |
|---|---|---|---|---|
| Base / starting price | Market starting_at or fixed | Confirm price + mode | Show fixed or “from $X” | — |
| Length tier | Offer S/M/L templates | Enable + price each | Select length | — |
| Coverage tier | Mini/partial/full presets | Enable SKUs | Select coverage | — |
| Finish package | Haircut vs blowdry variants | Enable | Select finish | — |
| Toner/gloss | Included text default | Included vs add-on | Disclosure or add-on | — |
| Extra product / bowl | **Do not default on** | If salon uses, internal | “Additional product may apply” only if salon opts in | Stylist records usage |
| Extension rows | 1-row / 2-row presets | Enable | Select maintenance SKU | Install density after consult |
| Consultation | Flag on color/extension | Required yes/no | Gate booking | Quote after |
| Brand treatment tier | Optional addon list | Prices | Select brand | — |
