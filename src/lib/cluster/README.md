# VMB cluster engine (phase 1–2)

- **`types.ts`** — `BaseEntity`, `Cluster`
- **`normalize.ts`** — name/address normalization + tokens
- **`scoring.ts`** — `scoreMatch` (distance + name + category)
- **`cluster-builder.ts`** — `buildClusters` (anchors = Google + DORA shop rows)

## UI route

The App Router cannot add `app/(vmb)/admin/page.tsx` without colliding with the existing `/admin` entry (`app/admin/page.tsx`). The cluster explorer is integrated on **`/admin/vmb`** (`src/app/admin/vmb/page.tsx`).

Replace `DEMO_CLUSTER_ENTITIES` with real `BaseEntity[]` when wiring APIs.
