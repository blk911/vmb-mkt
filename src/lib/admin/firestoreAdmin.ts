import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function adminDb() {
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
