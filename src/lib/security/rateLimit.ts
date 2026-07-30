/**
 * Shared rate limiting for public, abuse-prone routes.
 *
 * The limiters live behind a small async {@link RateLimitStore} interface. The in-memory store here
 * is per-process, which is fine for dev and single-instance deploys but NOT for production: Cloud
 * Run scales to 20 instances with no session affinity, so a caller landing on a different instance
 * gets a fresh counter. The shared implementation is {@link ./firestoreRateLimitStore}, selected via
 * `RATE_LIMIT_STORE=firestore`; design and rollout are in docs/SHARED_RATE_LIMIT_PLAN.md.
 *
 * Window semantics, caps, 429 messages, and getClientIp()/TRUST_PROXY handling are identical across
 * both stores. Keys are namespaced per limiter so one shared store never mixes counters across
 * routes. Store failures are a separate condition from being over the limit: see
 * {@link RateLimitFailMode}.
 */

import { logEvent, safeErrorType } from "../observability/logger";

/** Only trust X-Forwarded-For behind a known proxy (TRUST_PROXY=true). Preserved from server.ts. */
function trustProxy(): boolean {
  return process.env.TRUST_PROXY === "true";
}

/**
 * Resolve the client IP. Ignores the spoofable X-Forwarded-For header unless
 * TRUST_PROXY=true, then normalizes (strip IPv6-mapped IPv4 prefix, lowercase)
 * so one client maps to one bucket.
 */
export function getClientIp(req: any): string {
  let ip = "";
  if (trustProxy()) {
    ip = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  }
  if (!ip) {
    ip = req.socket?.remoteAddress || req.ip || "unknown";
  }
  return String(ip).replace(/^::ffff:/i, "").trim().toLowerCase() || "unknown";
}

/**
 * Storage seam for rate limiting. The in-memory implementation is the default;
 * a Redis-backed implementation can satisfy the same contract for shared,
 * multi-instance production limiting.
 */
export interface RateLimitStore {
  /** Daily fixed window keyed by UTC calendar day. Resolves true if the hit is allowed. */
  hitDaily(key: string, limit: number): Promise<boolean>;
  /** Burst fixed window of windowMs from the first hit. Resolves true if the hit is allowed. */
  hitBurst(key: string, limit: number, windowMs: number): Promise<boolean>;
}

/**
 * In-memory store replicating the original server.ts limiter logic exactly,
 * including the "do not increment once at the cap" behavior and the opportunistic
 * stale-bucket cleanup. Per-process only, not shared across instances.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly daily = new Map<string, { count: number; day: string }>();
  private readonly burst = new Map<string, { count: number; windowStart: number }>();

  async hitDaily(key: string, limit: number): Promise<boolean> {
    const today = new Date().toISOString().slice(0, 10);
    const entry = this.daily.get(key);
    let allowed: boolean;
    if (!entry || entry.day !== today) {
      this.daily.set(key, { count: 1, day: today });
      allowed = true;
    } else if (entry.count >= limit) {
      allowed = false;
    } else {
      entry.count += 1;
      allowed = true;
    }
    if (this.daily.size > 5000) {
      for (const [k, v] of this.daily) {
        if (v.day !== today) this.daily.delete(k);
      }
    }
    return allowed;
  }

  async hitBurst(key: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const entry = this.burst.get(key);
    let allowed: boolean;
    if (!entry || now - entry.windowStart > windowMs) {
      this.burst.set(key, { count: 1, windowStart: now });
      allowed = true;
    } else if (entry.count >= limit) {
      allowed = false;
    } else {
      entry.count += 1;
      allowed = true;
    }
    if (this.burst.size > 5000) {
      for (const [k, v] of this.burst) {
        if (now - v.windowStart > windowMs) this.burst.delete(k);
      }
    }
    return allowed;
  }
}

let sharedStore: RateLimitStore | null = null;

/**
 * Returns the process-wide in-memory store.
 *
 * Prefer `createRateLimitStore` from ./firestoreRateLimitStore, which returns this when Firestore
 * limiting is not configured and the shared store when it is. This function is kept for callers and
 * tests that specifically want per-process limiting.
 */
export function getRateLimitStore(): RateLimitStore {
  if (sharedStore) return sharedStore;
  sharedStore = new MemoryRateLimitStore();
  return sharedStore;
}

/**
 * What to do when the store itself fails (a shared store can, unlike the in-memory one).
 *
 * `closed` refuses the request. On the public routes that is the correct default: each one bills a
 * Gemini call, so an unavailable limiter must not become an unmetered allowance. `open` lets the
 * request through and is for routes where availability matters more than metering.
 */
export type RateLimitFailMode = "open" | "closed";

export interface RateLimitOptions {
  /** Defaults to `closed`. */
  failMode?: RateLimitFailMode;
  /** Body returned when the store failed. Deliberately distinct from the over-limit message. */
  unavailableMessage?: string;
}

const DEFAULT_UNAVAILABLE_MESSAGE = "This check is temporarily unavailable. Please try again in a moment.";

/**
 * Resolve a store outage into a response.
 *
 * A store failure returns 503, never 429. They are different conditions and conflating them would
 * tell a user they hit a quota they did not hit, and would make the two indistinguishable in logs
 * exactly when an operator needs to tell them apart.
 */
function handleStoreError(err: unknown, res: any, namespace: string, options?: RateLimitOptions): boolean {
  const failMode = options?.failMode ?? "closed";
  logEvent({
    event: "rate_limit_store_error",
    level: "error",
    errorType: safeErrorType(err),
    // Limiter namespace and the applied policy only: no key, no IP, nothing caller-derived.
    meta: { namespace, failMode },
  });
  if (failMode === "open") return true;
  res.status(503).json({ error: options?.unavailableMessage ?? DEFAULT_UNAVAILABLE_MESSAGE });
  return false;
}

/** Per-IP DAILY limiter middleware. Namespaced so limiters don't share counters. */
export function makeDailyRateLimit(
  namespace: string,
  limit: number,
  overLimitMessage: string,
  store: RateLimitStore,
  options?: RateLimitOptions,
) {
  return async function (req: any, res: any, next: any): Promise<void> {
    const key = `${namespace}:${getClientIp(req)}`;
    let allowed: boolean;
    try {
      allowed = await store.hitDaily(key, limit);
    } catch (err) {
      if (!handleStoreError(err, res, namespace, options)) return;
      next();
      return;
    }
    if (!allowed) {
      res.status(429).json({ error: overLimitMessage });
      return;
    }
    next();
  };
}

/** Per-IP short-window BURST limiter middleware. Namespaced so limiters don't share counters. */
export function makeBurstRateLimit(
  namespace: string,
  limit: number,
  windowMs: number,
  overLimitMessage: string,
  store: RateLimitStore,
  options?: RateLimitOptions,
) {
  return async function (req: any, res: any, next: any): Promise<void> {
    const key = `${namespace}:${getClientIp(req)}`;
    let allowed: boolean;
    try {
      allowed = await store.hitBurst(key, limit, windowMs);
    } catch (err) {
      if (!handleStoreError(err, res, namespace, options)) return;
      next();
      return;
    }
    if (!allowed) {
      res.status(429).json({ error: overLimitMessage });
      return;
    }
    next();
  };
}
