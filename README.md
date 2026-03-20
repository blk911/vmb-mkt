This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## VMB cluster engine — Step 8 forensic validation

The admin VMB cluster UI (`/admin/vmb`) includes a **Forensic validation** panel: per-candidate lock type, attach vs excluded noise, and dev console logging. See `src/lib/cluster/README.md`.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### Bundle size and `data/`

The repo root **`.vercelignore`** excludes most of **`data/`** (DORA tables, large derived outputs, etc.) so deployments stay under Vercel limits. **Exception:** the small JSON files under **`data/markets/`** needed for **`/admin/markets`** (regions, zones, zone members) are **included** via ignore negation — that page reads them from disk with `src/lib/markets.ts`.

Other admin routes that expect large files under `data/co/...` or multi‑MB `data/markets/*.json` will still be empty or local-only until you add a Firestore/API path or whitelist more files.

If those JSON files are missing at runtime, `markets.ts` falls back to **empty catalogs** so the app does not crash (empty dropdowns / no quick links).
