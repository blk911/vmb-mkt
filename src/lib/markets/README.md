# Markets catalog

- **`fsCatalog.ts`** — Reads `data/markets/*.json` from the repo root (`process.cwd()`). This is the **current** production path for `/admin/markets` (see root `.vercelignore` for which files ship to Vercel).
- **`../markets.ts`** — Public API (`getRegions`, `getMarkets`, `getZoneMembers`, …) built on the catalog layer.

To add a non-filesystem source (Firestore, API):

1. Implement loaders that return the same types as today’s JSON (`BeautyRegion[]`, etc.).
2. Switch in one place (e.g. env `MARKETS_CATALOG_SOURCE=fs|firestore`) rather than adding `readFileSync` in pages.
