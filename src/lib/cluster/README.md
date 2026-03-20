# VMB cluster engine

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
