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

## Step 8 — forensic validation

The cluster engine supports a **forensic validation** pass for the selected shop cluster (e.g. **Tribute Barbers**).

**Purpose**

- Show which nearby entities were **attached** vs **excluded as corridor noise**
- Explain whether **`getLocationLockResult`** fired via **exact normalized address**, **suite match**, or **same building / pad**
- Surface **`buildMatchBreakdown`** score + distance per candidate
- In development, **`logClusterForensicReport`** prints the full report to the browser console when you select a cluster

**Where**

- **`forensics.ts`** — `buildClusterForensicReport(cluster, allEntities)`
- **`ClusterDetailPanel`** — “Forensic validation” section at `/admin/vmb` (pass `allEntities={data}`)

**What not to do here**

- Do not widen score thresholds or loosen the hard lock to “make Tribute look better” — empty or thin DORA rows after lock means the truth surfaced; next step is data/legal-name/suite coverage, not fuzzy hacks.
