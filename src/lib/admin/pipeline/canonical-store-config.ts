export type CanonicalPipelineStoreMode = "file" | "firestore";

function hasFirebaseAdminEnv(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
  );
}

export function getCanonicalPipelineStoreMode(): CanonicalPipelineStoreMode {
  return process.env.VMB_CANONICAL_PIPELINE_STORE?.trim() === "firestore" && hasFirebaseAdminEnv()
    ? "firestore"
    : "file";
}

export function usesFirestoreCanonicalPipelineStore(): boolean {
  return getCanonicalPipelineStoreMode() === "firestore";
}
