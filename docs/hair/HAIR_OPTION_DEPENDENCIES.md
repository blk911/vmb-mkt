# HAIR OPTION DEPENDENCIES

Derived from live menus (Perlino, The Place, Tulip’s). Rows with evidenceCount &lt; 2 are **LOW_N**.

## Dependency matrix

| Option / child | Allowed parents | Required parents | Mutually exclusive | Default included | Client-visible | Salon-only |
|---|---|---|---|---|---|---|
| Toner / glaze / gloss | Highlights, custom color, blonding, all-over | Often bundled; can be standalone | Standalone vs “included in custom color” | Often **included** in custom color copy (“Includes custom toning”) | Yes | — |
| Haircut finish | Color / highlight services | Optional alternate to blowdry package | Blowdry finish package | Salon chooses which packages to publish | Yes as package SKU | — |
| Blowdry / style finish | Color / highlight / treatment | Optional | Haircut finish package | Same | Yes | — |
| Length tier S/M/L | Cut, color+cut, highlight SKUs | Parent service | Other length tiers | Mid default **ASSUMPTION** | Yes | — |
| Coverage mini/partial/full | Custom color / highlight families | Parent family | Other coverage tiers | — | Yes | — |
| Extension install density | Extension family | **Consultation required** | Other density tiers | — | SKU list after consult | Quote details |
| Row maintenance 1 vs 2 | Hand-tied / weft maintenance | Existing extensions | Other row counts | — | Yes | — |
| Bond builder / Olaplex | Color / lightening / treatments | Optional | Competing brand treatments | Sometimes listed as treatment tier | Yes if sold as treatment | Chemistry notes |
| Detangling | — | — | — | — | — | **NOT_OBSERVED** |
| Extra bowl / ounce | Chemical color | — | — | — | Prefer disclosure only | **NOT_OBSERVED** as selectable |
| Extension removal | Extension install / move-up | — | — | — | — | **NOT_OBSERVED** in sample |
| Beard trim | Mens cut / barber | Optional add-on | — | Off | Yes | — |
| Add-on curls | Updo / style | Optional | — | Off | Yes | — |
| Scalp treatment add-on | Cut / color / style | Optional | — | Off | Yes | — |
| Airbrush makeup | Makeup application | Optional add (“not included”) | — | Off | Yes | Cross-vertical |

## Notable packaging pattern

Many “dependencies” are **precomposed SKUs** (`Full Highlight with Haircut`) rather than runtime option graphs.

**Implication for shared engine:** Prefer supporting:
1. Fixed add-ons (Gel X style)
2. Mutually exclusive tier groups
3. Consultation gate
4. Optional “includedElements” text

…before building a full dependency DSL.

## Consultation triggers (observed)

| Trigger | Evidence |
|---|---|
| First-time major color change | Perlino highlight consult $5 |
| Custom / transformative color | Perlino color consult $0 |
| Extension install (all densities) | “A consultation required to book this service” |
| Keratin / Brazilian new clients | Brazillian + Keratin Consultation |
| Bridal | Bridal Consultation $0 |
| General consultation SKU | The Place “Consultation” |

## Rare / defer

- Detangling surcharges
- Corrective color as multi-session dependency graph
- Move-up / removal chains
- Wig / sew-in / braid takedown dependencies
