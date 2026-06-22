/**
 * Firebase App Check verification middleware for public, abuse-prone routes.
 *
 * DEFAULT-OFF: when `APP_CHECK_ENFORCE !== "true"` the middleware passes every
 * request through unchanged, so local dev, tests, and current production
 * behavior are not affected until an operator explicitly enables enforcement.
 *
 * When enabled, a missing or invalid `X-Firebase-AppCheck` header is rejected
 * with 401 before any costly work (rate-limited handlers, Gemini calls) runs.
 *
 * The token verifier is injectable for testing. In production it lazily loads
 * the Firebase Admin App Check verifier, so importing this module never pulls in
 * the Admin SDK during unit tests.
 *
 * NOTE: enabling enforcement requires the client to attach an App Check token
 * (see docs/APP_CHECK_IMPLEMENTATION_PLAN.md). Do not set APP_CHECK_ENFORCE=true
 * in production until the client integration and reCAPTCHA provider are live.
 */

export interface AppCheckRequest {
  header(name: string): string | undefined;
}

export interface AppCheckResponse {
  status(code: number): AppCheckResponse;
  json(body: unknown): void;
}

export type AppCheckNext = (err?: unknown) => void;

export type AppCheckVerifier = (token: string) => Promise<unknown>;

/** True only when App Check enforcement is explicitly enabled. Default OFF. */
export function isAppCheckEnforced(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.APP_CHECK_ENFORCE === "true";
}

export interface AppCheckMiddlewareOptions {
  /** Injectable verifier (tests). Defaults to the Firebase Admin verifier. */
  verifier?: AppCheckVerifier;
  /** Injectable enforcement check (tests). Defaults to env-based check. */
  isEnforced?: () => boolean;
}

export function createAppCheckMiddleware(opts: AppCheckMiddlewareOptions = {}) {
  const isEnforced = opts.isEnforced ?? (() => isAppCheckEnforced());
  let verifierPromise: Promise<AppCheckVerifier> | null = null;

  async function getVerifier(): Promise<AppCheckVerifier> {
    if (opts.verifier) return opts.verifier;
    if (!verifierPromise) {
      verifierPromise = import("firebase-admin/app-check").then(
        (mod) => (token: string) => mod.getAppCheck().verifyToken(token),
      );
    }
    return verifierPromise;
  }

  return async function verifyAppCheck(
    req: AppCheckRequest,
    res: AppCheckResponse,
    next: AppCheckNext,
  ): Promise<void> {
    if (!isEnforced()) {
      next();
      return;
    }
    const token = req.header("X-Firebase-AppCheck");
    if (!token) {
      res.status(401).json({ error: "App Check token required." });
      return;
    }
    try {
      const verify = await getVerifier();
      await verify(token);
      next();
    } catch {
      res.status(401).json({ error: "Invalid App Check token." });
    }
  };
}
