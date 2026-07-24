# HAIR ↔ GEL X GAP MATRIX

**Gel X reference (read-only):** `C:\dev\venmebaby-app-source\lib\vmb\services\`  
Especially: `service-preset-types.ts`, `default-service-presets.ts`, `canonical-catalog-types.ts`.

**Hair evidence:** 3 live menus + 90-operator identity sample. Frequency column uses live-menu operator counts unless noted.

| CAPABILITY | Gel X currently supports? | Hair requires? | Frequency in Hair evidence | Shared primitive needed? | Configuration-only? | Defer? |
|---|---|---|---|---|---|---|
| service title | Yes (`displayName`) | Yes | 3/3 | No | Yes | No |
| description | Yes (`shortDescription`) | Yes | 3/3 | No | Yes | No |
| included elements | Yes (`includedText`) | Yes (toning, blowout, shampoo language) | 3/3 | No | Yes | No |
| base price | Yes (`basePriceCents` fixed) | Yes | 3/3 | No | Yes | No |
| private-client price | Yes (PCN fields) | Unknown for Hair | 0 Hair-specific | No | Yes | Yes for Hair dig |
| duration | Yes (`durationMinutes`) | Yes | 2/3+ | No | Yes | No |
| fixed option / add-on | Yes (`addonPresets` price + defaultSelected) | Yes (curls, scalp, beard) | 1–2 | No | Yes | No |
| tier option (length S/M/L) | Partial (exclusive addons possible) | **Yes** | 1 strong (The Place) | Prefer `optionGroup=tier` | Mostly config if exclusive addons enforced | No |
| coverage tier (mini/partial/full) | Partial via separate offers or addons | **Yes** | 3/3 | Prefer tier group or separate offers | Yes (separate offers OK) | No |
| quantity option | Partial (no unit label / included qty) | Row count (low N); ounce **not observed** | 1 (rows) | `unitLabel` only if multi-vertical need | Config SKUs for rows | Ounce: **Defer** |
| option price delta | Yes | Yes | 2/3 | No | Yes | No |
| option duration delta | **No** (addon has price only, not duration) | **Yes** (length tiers change duration) | 1 strong | **`durationDelta` on options** | No | No |
| conditional option | Weak (map offer→addon only) | Medium (toner with color) | 2 | Optional later | Prefer includedText + packages | Soft defer |
| required dependency | No | Consultation before extension/color | 2 | **`consultationRequired`** / booking gate | Partial via separate consult SKU | No |
| starting-at price | **No** | **Yes** | 1 dominant (Perlino) | **`pricingMode: starting_at`** | No | No |
| price range min/max | **No** | Weak (not explicit $A–$B) | 0 | Not yet | — | **Defer** |
| consultation-only | **No** | **Yes** | 2 | `consultationRequired` + $0 consult SKU | Config consult SKUs help | No |
| internal-only modifier | **No** | Bowl/ounce if ever | 0 observed | `clientVisibility` / `salonDetermined` | — | **Defer** until observed |
| salon validation | Yes | Yes | Platform | No | Yes | No |
| admin publish | Yes | Yes | Platform | No | Yes | No |
| salon detach | Yes (ownership statuses) | Yes | Platform | No | Yes | No |
| client display | Yes | Yes — simpler than salon ops | 3/3 | Visibility flags if internal mods added | Yes | No |
| finish package variants | Via separate offers | Common | 2/3 | No (multiple offers) | **Yes** | No |
| stylist level pricing | No | Not observed | 0 | — | — | **Defer** |
| deposit-only | No | Not observed | 0 | — | — | **Defer** |

## Verdict on “90% config vs shared extension”

| Assessment | Result |
|---|---|
| Expressible with current Gel X structure (config/presets/offers/addons) | **Cuts, fixed-price color SKUs, simple add-ons, included text, salon validate/detach** |
| Blocked or awkward without shared primitives | **`starting_at` display/pricing mode; option `durationDelta`; consultation gate; clean length tiers** |
| Not evidenced — do not build yet | Ounce/bowl client UX, price ranges, stylist level, deposit-only, detangle density engine |

**Estimated split from this dig:** roughly **70–80% configuration** (Hair catalog + packages + addons) and **20–30% shared-model extension** (pricingMode + durationDelta + consultationRequired).  
**Not** “another vertical engine.”  
**Not** proven as “only 10% extension” because starting-at + duration-by-tier are central in the strongest menus.

## What Hair can express unchanged

- Title, description, included elements  
- Fixed base price services  
- Add-ons with price deltas  
- Multiple catalog offers per category (package explosion: “Highlight + Haircut”)  
- Admin defaults → salon validation → detached salon copy → client output  

## What Hair cannot express cleanly

- Public “Starting at $X” without lying that price is fixed  
- Length tier that changes **both** price and duration as one client choice  
- Hard consultation requirement before bookable install  
- (Future) stylist-determined product quantity without polluting client UX  
