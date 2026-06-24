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
