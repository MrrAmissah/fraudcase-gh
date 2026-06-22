/**
 * CAPTCHA / Cloudflare Turnstile server-side verification for public, abuse-prone
 * routes (human attestation, complementing App Check's app attestation).
 *
 * DEFAULT-OFF: when `CAPTCHA_ENFORCE !== "true"` the middleware passes every
 * request through unchanged, so local dev, tests, and current behavior are not
 * affected until an operator enables it and provisions keys.
 *
 * No secret is committed: the provider secret is read from `CAPTCHA_SECRET_KEY`
 * at request time. The token verifier is injectable for testing; the default
 * verifies against Cloudflare Turnstile's siteverify endpoint.
 *
 * See docs/APP_CHECK_IMPLEMENTATION_PLAN.md ("CAPTCHA complement").
 */

export interface CaptchaRequest {
  header(name: string): string | undefined;
}

export interface CaptchaResponse {
  status(code: number): CaptchaResponse;
  json(body: unknown): void;
}

export type CaptchaNext = (err?: unknown) => void;

/** Verifies a CAPTCHA response token server-side. Resolves true if human-verified. */
export type CaptchaVerifier = (token: string) => Promise<boolean>;

/** True only when CAPTCHA enforcement is explicitly enabled. Default OFF. */
export function isCaptchaEnforced(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CAPTCHA_ENFORCE === "true";
}

/**
 * Default verifier: Cloudflare Turnstile siteverify. Reads CAPTCHA_SECRET_KEY at
 * call time; a missing secret resolves false (fail closed while enforced). Only
 * invoked when enforcement is on, so it never runs in dev/tests by default.
 */
async function turnstileVerify(token: string): Promise<boolean> {
  const secret = process.env.CAPTCHA_SECRET_KEY;
  if (!secret) return false;
  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const data = (await resp.json()) as { success?: boolean };
  return data.success === true;
}

export interface CaptchaMiddlewareOptions {
  /** Injectable verifier (tests). Defaults to Cloudflare Turnstile. */
  verifier?: CaptchaVerifier;
  /** Injectable enforcement check (tests). Defaults to env-based check. */
  isEnforced?: () => boolean;
  /** Request header carrying the CAPTCHA response token. */
  headerName?: string;
}

export function createCaptchaMiddleware(opts: CaptchaMiddlewareOptions = {}) {
  const isEnforced = opts.isEnforced ?? (() => isCaptchaEnforced());
  const verifier = opts.verifier ?? turnstileVerify;
  const headerName = opts.headerName ?? "X-Captcha-Token";

  return async function verifyCaptcha(
    req: CaptchaRequest,
    res: CaptchaResponse,
    next: CaptchaNext,
  ): Promise<void> {
    if (!isEnforced()) {
      next();
      return;
    }
    const token = req.header(headerName);
    if (!token) {
      res.status(400).json({ error: "Captcha verification required." });
      return;
    }
    try {
      const ok = await verifier(token);
      if (!ok) {
        res.status(403).json({ error: "Captcha verification failed." });
        return;
      }
      next();
    } catch {
      res.status(403).json({ error: "Captcha verification failed." });
    }
  };
}
