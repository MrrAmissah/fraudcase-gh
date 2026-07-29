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

/**
 * Default Gemini model id.
 *
 * `gemini-2.5-flash` is deprecated on Vertex from 2026-10-20 (Extended Lifecycle Access), with a
 * significant price rise from 2027-01-28, so the default moved to a recommended GA successor.
 *
 * `gemini-3.1-flash-lite` was chosen by measuring all the recommended targets against the real
 * {@link fraudCaseSchema} on Vertex, two runs each (latency / risk score):
 *
 *   gemini-2.5-flash       17.1-18.3s   85-90   <- previous default, exceeded the 15s timeout
 *   gemini-3.5-flash       15.1s        85
 *   gemini-3.6-flash        7.3s        88
 *   gemini-3.5-flash-lite   3.1-4.3s    85
 *   gemini-3.1-flash-lite   3.9-4.2s    90      <- chosen
 *
 * All produced schema-valid output and agreed on category and confidence. The lite tier is also
 * what the deprecation notice recommends for cost. Note the old default was running 17-18s against
 * a 15s timeout, so real analyses were likely degrading to the heuristic before this change.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

/**
 * Resolve the Gemini model id, honoring the `GEMINI_MODEL` override and falling back to the stable
 * default. Used by BOTH the case analyzer and the multimodal extractor so an env override applies
 * everywhere (previously the analyzer hardcoded its model and ignored the env var).
 */
export function resolveGeminiModel(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.GEMINI_MODEL || "").trim();
  return raw || DEFAULT_GEMINI_MODEL;
}

/**
 * Default Vertex AI location used when GOOGLE_CLOUD_LOCATION is unset.
 *
 * Must be `global` for the Gemini 3.x family. Measured against this project: every 3.x candidate
 * (3.5-flash, 3.5-flash-lite, 3.1-flash-lite, 3.6-flash) returns `ApiError:404` in `us-central1`
 * but serves correctly from `global`. `gemini-2.5-flash` serves from both, so this is safe to
 * change independently of the model.
 *
 * The 404 is the dangerous failure here: the analyzer catches it and falls back to the heuristic,
 * so a region mismatch degrades analysis quality silently rather than erroring loudly.
 */
export const DEFAULT_VERTEX_LOCATION = "global";

export interface ResolvedGenAIConfig {
  vertexai: boolean;
  apiKey?: string;
  project?: string;
  location?: string;
}

/**
 * Decide how to construct the `@google/genai` client, so the same code runs against either backend:
 *  - **Vertex AI** when `GOOGLE_GENAI_USE_VERTEXAI=true`: uses ADC (the runtime service account), the
 *    project (`GOOGLE_CLOUD_PROJECT` or `VITE_FIREBASE_PROJECT_ID`) and a region
 *    (`GOOGLE_CLOUD_LOCATION` or {@link DEFAULT_VERTEX_LOCATION}). No API key; billed via Cloud Billing.
 *  - **Gemini API (AI Studio)** otherwise: uses `GEMINI_API_KEY`.
 * Returns `null` when nothing is configured, so callers fall back to the heuristic (calm no-op).
 */
export function resolveGenAIClientConfig(env: NodeJS.ProcessEnv = process.env): ResolvedGenAIConfig | null {
  if ((env.GOOGLE_GENAI_USE_VERTEXAI || "").trim().toLowerCase() === "true") {
    const project = (env.GOOGLE_CLOUD_PROJECT || env.VITE_FIREBASE_PROJECT_ID || "").trim();
    if (!project) return null;
    const location = (env.GOOGLE_CLOUD_LOCATION || "").trim() || DEFAULT_VERTEX_LOCATION;
    return { vertexai: true, project, location };
  }
  const apiKey = (env.GEMINI_API_KEY || "").trim();
  if (!apiKey) return null;
  return { vertexai: false, apiKey };
}
