export type CanonicalPipelineStoreMode = "file" | "firestore";
function hasFirebaseAdminEnv(): boolean {
  return Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
}
export function getCanonicalPipelineStoreMode(): CanonicalPipelineStoreMode {
  const mode = process.env.VMB_CANONICAL_PIPELINE_STORE?.trim() || (process.env.NODE_ENV === "production" ? "firestore" : "file");
  if (mode !== "file" && mode !== "firestore") throw new Error("canonical_store_unavailable");
  if (mode === "firestore" && !hasFirebaseAdminEnv()) throw new Error("canonical_store_unavailable");
  if (process.env.NODE_ENV === "production" && mode !== "firestore") throw new Error("canonical_store_requires_firestore");
  return mode;
}
export function usesFirestoreCanonicalPipelineStore(): boolean { return getCanonicalPipelineStoreMode() === "firestore"; }
