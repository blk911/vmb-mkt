import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

dotenv.config({ path: ".env.local" });

const COL = "places_candidates";

function must(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env var: ${name}`);
  return v;
}

function db() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: must("FIREBASE_PROJECT_ID"),
        clientEmail: must("FIREBASE_CLIENT_EMAIL"),
        privateKey: must("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
      }),
    });
  }
  return getFirestore();
}

function loadRows(filePath: string): any[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const json = JSON.parse(raw);
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.rows)) return json.rows;
  throw new Error("Expected JSON array or { rows: [...] }");
}

async function main() {
  const input = process.argv[2];
  if (!input) {
    throw new Error(
      "Usage: npx ts-node scripts/firestore_import_candidates.ts <path-to-places_candidates.v1.json>"
    );
  }

  const file = path.resolve(input);
  const rows = loadRows(file);
  const firestore = db();

  console.log(`Importing ${rows.length} rows into Firestore collection "${COL}"...`);

  const BATCH = 400;
  let written = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const batch = firestore.batch();

    for (const r of slice) {
      // Use addressKey as stable doc id if present, else auto id.
      const id =
        typeof r?.addressKey === "string" && r.addressKey.trim()
          ? r.addressKey.trim()
          : null;

      const ref = id ? firestore.collection(COL).doc(id) : firestore.collection(COL).doc();
      batch.set(ref, { ...r, importedAt: Date.now() }, { merge: true });
      written++;
    }

    await batch.commit();
    console.log(`Committed ${Math.min(i + BATCH, rows.length)} / ${rows.length}`);
  }

  console.log(`DONE ✅ Wrote ${written} docs to ${COL}`);
}

main().catch((e) => {
  console.error("IMPORT FAILED ❌", e);
  process.exit(1);
});
