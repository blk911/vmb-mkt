# HAIR FRAMEWORK RECOMMENDATION

## Executive conclusion

Hair can largely ride the existing Nail/Gel X service engine as **catalog configuration** (offers, included text, add-ons, salon validation, detach, client display).  

The live Denver menus prove two gaps that are **shared-market**, not Hair-only novelties:

1. **`pricingMode: starting_at`** (and later optional range)  
2. **Tier choices that adjust duration as well as price** (`durationDelta` or tier duration map)  
3. **`consultationRequired`** booking/display gate for extensions and major color  

Do **not** add ounce/bowl client UX, a second service engine, or a textured-hair schema until more menus are captured. Textured/braid/loc/wig patterns must remain **visible specialist groups**, not erased into generic Cuts.

This was an **evidence dig**, not a product build. No VMB app code, schemas, or production datasets were modified.

---

## Minimum shared extensions (validate — do not implement in this dig)

| Primitive | Evidence count (operators) | Services affected | Why existing structure fails | Nails reuse? | Brows/Wax/Skin reuse? | Priority |
|---|---:|---|---|---|---|---|
| `pricingMode` (`fixed` \| `starting_at`) | 1 strong + industry-consistent with that menu | Most color/treatment SKUs at Perlino | Gel X stores a single fixed `basePriceCents` | Possible (“from $X” gel art) | Yes (many “starting at”) | **P0** |
| `durationDelta` on options / tiers | 1 strong (The Place length tiers) | Cut + color length tiers | Addons have price only | Yes (length addons already; duration often rises) | Sometimes | **P0** |
| `consultationRequired` | 2 | Extensions, major color, keratin | No booking gate primitive | Rare | Wax/skin consults | **P0** |
| Tier option group (mutually exclusive) | 3 (coverage) / 1 (length) | Color coverage; length | Possible via addons but easy to misconfigure | Yes (Gel X length) | Yes | **P1** (may be config discipline first) |
| `unitLabel` + `includedQuantity` + `additionalUnitPrice` | 1 (rows only); ounce **0** | Extension maintenance | No unit semantics | Weak | Weak | **P2** — use separate SKUs for rows until ≥3 operators |
| `priceRangeMin` / `priceRangeMax` | 0 explicit | — | — | — | — | **Defer** |
| `clientVisibility` / `salonDetermined` | 0 bowl/ounce | Future chemistry | — | Useful later | Useful later | **Defer** until internal modifiers observed |
| `optionDependencies` DSL | Soft (packages dominate) | Toner/finish | Packages + includedText suffice now | — | — | **Defer** |

### Rejected / not recommended from this dig

| Idea | Why reject now |
|---|---|
| Per-ounce client dropdown | **NOT_OBSERVED** in live sample |
| New Hair-only pricing engine | Overkill; shared primitives above suffice |
| Force all textured services into Cuts & Styling | Would erase specialist market; evidence incomplete |
| Four+ client categories as MVP | Three client categories work as rollup; salon menus stay richer |
| Schema/migration in this branch | Unauthorized / premature |

---

## Admin default structure (proposed)

- Publish Hair category with three client sections.  
- Seed offers: women’s cut, men’s cut, blow-dry, root touch-up, all-over color, partial highlight, full highlight, balayage/custom color, glaze, keratin starting_at, deep condition, extension consult.  
- Default `pricingMode=starting_at` on color/lightening/treatment; `fixed` on simple cuts where menus show fixed.  
- Length tier template available but salon-enabled.  
- Extension installs: `consultationRequired=true`.

## Salon validation structure

- Confirm which offers enabled.  
- Override prices, durations, included text.  
- Enable/disable length tiers and finish packages.  
- Mark consult-required services.  
- Detach from admin preset when customized.

## Client display structure

- Simple category tabs: Cuts & Styling | Color & Lightening | Treatments & Extensions.  
- Show fixed price or “From $X”.  
- Length / coverage as clear choices when enabled.  
- Do not show bowls/ounces.  
- Consultation services bookable as $0/$low or blocked until consult policy defined.

---

## Evidence gaps (blocking stronger claims)

1. Committed evidence lake empty for Hair menus.  
2. Only **3** usable live menus from corpus URLs.  
3. Zero braid/loc/silk press/wig menu captures.  
4. Zero ounce/bowl captures.  
5. Booking enrichment polluted with platform junk URLs.  
6. Multiservice labeling weak in zone schema.

## Additional URLs / live samples needed

Priority fetch list (already attached to sample operators where possible):

- Clean Vagaro/Square/Booksy/GlossGenius **business** pages (not `/growth`, `/privacy`, `/pro`)  
- Specialty operators by name signal: Black Moon / natural texture, Color Crush (fix URL), extension salons (AURA), suite tenants at 44 Cook St  
- Target: **≥15** menus before locking shared primitives beyond P0  
- Capture: service name, price mode, tiers, duration, consult gates, add-ons — store under `data/research/hair/raw_fetches/`

---

## Backstop checklist

- [x] Evidence dig, not product build  
- [x] Used existing VMB operator corpus before outside research  
- [x] Three Hair categories tested against natural clusters (rollup OK; not the only structure)  
- [x] Textured/natural/extension patterns not erased  
- [x] Market language preserved in JSON/docs  
- [x] Client simplicity separated from salon complexity  
- [x] No shared schema change  
- [x] No VMB app code change  
- [x] No deployment  
