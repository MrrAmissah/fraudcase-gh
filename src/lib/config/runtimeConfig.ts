/**
 * Pure runtime-configuration helpers (no side effects) so server bootstrap values are unit-testable.
 * Used by `server.ts` (port) and `src/lib/firebase/admin.ts` (Firestore database id).
 */

/** Default listen port for local dev. Container platforms (Cloud Run) inject PORT at runtime. */
export const DEFAULT_PORT = 3000;

/**
 * Resolve the listen port. Honors `process.env.PORT` (set by Cloud Run and most PaaS), falling back
 * to {@link DEFAULT_PORT} for local dev. A missing, empty, zero, or non-numeric PORT falls back to
 * the default, so local `npm run dev` still serves on 3000 with no env set.
 */
export function resolvePort(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.PORT);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PORT;
}

/**
 * Default server-side Firestore database id (the provisioned AI Studio named database). Only the
 * project id and storage bucket come from env; this id was previously hardcoded in admin.ts.
 */
export const DEFAULT_FIRESTORE_DATABASE_ID = "ai-studio-36d6feb3-b3c2-4e2a-9c6b-46c7b67a02e9";

/**
 * Resolve the Firestore database id for the Firebase Admin (server) SDK. Honors an explicit
 * `FIRESTORE_DATABASE_ID` override (for example a separate staging project's database), and falls
 * back to {@link DEFAULT_FIRESTORE_DATABASE_ID}. An empty or whitespace-only value falls back to the
 * default and never silently selects Firestore's `(default)` database (which would read as
 * false-clean during verification). The CLIENT uses the build-time `VITE_FIREBASE_FIRESTORE_DATABASE_ID`.
 */
export function resolveFirestoreDatabaseId(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.FIRESTORE_DATABASE_ID || "").trim();
  return raw || DEFAULT_FIRESTORE_DATABASE_ID;
}
