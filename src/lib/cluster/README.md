# VMB cluster engine

## Hard location lock

Entities only become **primary cluster candidates** when **`hasHardLocationLock(anchor, entity)`** is true:

- **`normalizedAddressMatchExact`** — full `normalizeAddress` equality (min length)
- **`sameBuildingParcel`** — same street # + close GPS, or long address prefix, or very tight pin (≤ ~0.025 mi)
- **`suiteMatch`** — suite/unit tokens present on both sides and overlap

Otherwise they are recorded as **`nearby-noise:…`** and **do not** attach to Google/DORA/tech buckets. Anchor↔anchor merges use the same gate in **`merge-clusters.ts`**.

## Phase 3

- **`types.ts`** — `BaseEntity`, `Cluster`, `ClusterAttachment`, `MatchBreakdown`, `DiagnosticCode`
- **`normalize.ts`** — legal/geo/service stop words, `buildBrandCoreName`, address normalization
- **`scoring.ts`** — `buildMatchBreakdown` (distance, name, category, address, phone/website)
- **`cluster-builder.ts`** — provisional clusters per shop anchor → **`mergeOverlappingClusters`**
- **`merge-clusters.ts`** — dominant anchor merge (overlapping Google + DORA heads collapse to one row)
- **`diagnostics.ts`** — human-readable diagnostic labels

## UI

Integrated on **`/admin/vmb`** via `VmbClusterExplorer` (not `app/(vmb)/admin/page.tsx`, which would collide with `/admin`).

## QA

- Same-brand Google + nearby DORA shop → one row after merge.
- `dora_person` never becomes a shop anchor row.
- Competing brands at same distance → merge blocked when `COMPETING_BRAND` logic fires.

Map `lat`, `lng`, `address`, `category`, `licenseId`, etc. before passing entities to `useClusters`.
