/**
 * Shared rate limiting for public, abuse-prone routes.
 *
 * This extracts the previously-inline in-memory limiters from server.ts behind a
 * small async {@link RateLimitStore} interface so a Redis/Upstash-backed shared
 * store (for multi-instance production) can be slotted in later via
 * RATE_LIMIT_REDIS_URL — see docs/SHARED_RATE_LIMIT_PLAN.md.
 *
 * Behavior is preserved exactly with the default in-memory store: the same daily
 * and burst caps, the same fixed-window semantics, the same 429 messages, and the
 * same getClientIp()/TRUST_PROXY handling. Keys are namespaced per limiter so a
 * single shared store does not mix counters across routes.
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
 * stale-bucket cleanup. Per-process only — not shared across instances.
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
 * Returns the process-wide rate limit store. If RATE_LIMIT_REDIS_URL is set we
 * log that the shared Redis store is not yet wired (rather than silently behaving
 * as if it were shared) and fall back to in-memory. The Redis implementation is
 * tracked in docs/SHARED_RATE_LIMIT_PLAN.md.
 */
export function getRateLimitStore(): RateLimitStore {
  if (sharedStore) return sharedStore;
  if (process.env.RATE_LIMIT_REDIS_URL) {
    logEvent({ event: "rate_limit_redis_not_implemented", level: "warn" });
  }
  sharedStore = new MemoryRateLimitStore();
  return sharedStore;
}

/** Per-IP DAILY limiter middleware. Namespaced so limiters don't share counters. */
export function makeDailyRateLimit(
  namespace: string,
  limit: number,
  overLimitMessage: string,
  store: RateLimitStore,
) {
  return async function (req: any, res: any, next: any): Promise<void> {
    const key = `${namespace}:${getClientIp(req)}`;
    let allowed = true;
    try {
      allowed = await store.hitDaily(key, limit);
    } catch (err) {
      // The in-memory store never throws. A future shared store will define an
      // explicit fail-closed policy (SHARED_RATE_LIMIT_PLAN.md); for now, fail open.
      logEvent({ event: "rate_limit_store_error", level: "warn", errorType: safeErrorType(err) });
      allowed = true;
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
) {
  return async function (req: any, res: any, next: any): Promise<void> {
    const key = `${namespace}:${getClientIp(req)}`;
    let allowed = true;
    try {
      allowed = await store.hitBurst(key, limit, windowMs);
    } catch (err) {
      logEvent({ event: "rate_limit_store_error", level: "warn", errorType: safeErrorType(err) });
      allowed = true;
    }
    if (!allowed) {
      res.status(429).json({ error: overLimitMessage });
      return;
    }
    next();
  };
}
