/**
 * Firestore-backed {@link RateLimitStore} for shared, multi-instance rate limiting.
 *
 * WHY: the in-memory store is per-process, and production runs Cloud Run with `maxScale=20` and no
 * session affinity. A caller that lands on a different instance gets a fresh counter, so the real
 * ceiling was roughly 20x the configured cap on endpoints that each bill a Gemini call. Firestore
 * is already provisioned and already a dependency here, so a transactional counter document gives
 * cross-instance limits with no new infrastructure to run, secure, or pay for.
 *
 * PRIVACY: keys arrive as `namespace:ip`, and this app deliberately keeps IP addresses in memory
 * only. Persisting them would create a new class of stored personal data, so document ids are an
 * HMAC-SHA256 of the key under a server-side salt, never the raw key. A plain SHA-256 would not be
 * enough: the entire IPv4 space is small enough to enumerate, so unsalted digests are reversible.
 * Without a configured salt this module refuses to use Firestore at all and falls back to memory
 * rather than writing weak hashes (see {@link createRateLimitStore}).
 *
 * CLEANUP: every document carries `expiresAt` for a Firestore TTL policy. The one-time setup
 * command and the rest of the rollout are in docs/SHARED_RATE_LIMIT_PLAN.md. Without that policy
 * the collection grows without bound; correctness is unaffected because every window is keyed.
 */

import crypto from "node:crypto";
import { logEvent } from "../observability/logger";
import { MemoryRateLimitStore, type RateLimitStore } from "./rateLimit";

/** Collection holding rate-limit counters. Contains no raw identifiers, only salted hashes. */
export const DEFAULT_RATE_LIMIT_COLLECTION = "rateLimits";

/** Minimum salt length. Short salts are brute-forceable alongside the small IPv4 space. */
export const MIN_SALT_LENGTH = 16;

/**
 * Minimal Firestore surface this store needs, so tests can supply a fake and this module never
 * imports firebase-admin at runtime.
 */
export interface RateLimitFirestore {
  collection(path: string): {
    doc(id: string): unknown;
  };
  runTransaction<T>(updateFunction: (tx: any) => Promise<T>): Promise<T>;
}

/**
 * Salted, truncated HMAC of a limiter key. Truncation to 32 hex chars (128 bits) keeps document ids
 * short while leaving collision probability negligible at any plausible traffic level.
 */
export function hashLimiterKey(key: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(key).digest("hex").slice(0, 32);
}

/** UTC calendar day, matching the in-memory store's daily window exactly. */
function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export class FirestoreRateLimitStore implements RateLimitStore {
  constructor(
    private readonly db: RateLimitFirestore,
    private readonly salt: string,
    private readonly collectionName: string = DEFAULT_RATE_LIMIT_COLLECTION,
    private readonly now: () => number = Date.now,
  ) {
    if (!salt || salt.length < MIN_SALT_LENGTH) {
      throw new Error(`FirestoreRateLimitStore requires a salt of at least ${MIN_SALT_LENGTH} characters`);
    }
  }

  private ref(id: string): any {
    return this.db.collection(this.collectionName).doc(id);
  }

  /**
   * Daily fixed window keyed by UTC day. The day is part of the document id, so a new day starts a
   * new document and no reset logic is needed; the old one is removed by the TTL policy.
   */
  async hitDaily(key: string, limit: number): Promise<boolean> {
    const now = this.now();
    const day = utcDay(now);
    const ref = this.ref(`d_${day}_${hashLimiterKey(key, this.salt)}`);
    // Keep a day of slack past the window so a late-arriving request cannot resurrect a
    // half-expired counter and hand out a fresh allowance.
    const expiresAt = new Date(now + 2 * 24 * 60 * 60 * 1000);

    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const count = snap.exists ? Number(snap.get("count") ?? 0) : 0;
      if (count >= limit) return false;
      tx.set(ref, { count: count + 1, window: day, expiresAt }, { merge: true });
      return true;
    });
  }

  /**
   * Burst fixed window measured from the first hit, matching the in-memory store: the window
   * resets only once `windowMs` has elapsed since `windowStart`, not on a rolling basis.
   */
  async hitBurst(key: string, limit: number, windowMs: number): Promise<boolean> {
    const now = this.now();
    const ref = this.ref(`b_${hashLimiterKey(key, this.salt)}`);

    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const windowStart = snap.exists ? Number(snap.get("windowStart") ?? 0) : 0;
      const count = snap.exists ? Number(snap.get("count") ?? 0) : 0;
      const expired = !snap.exists || now - windowStart > windowMs;

      if (expired) {
        tx.set(ref, { count: 1, windowStart: now, expiresAt: new Date(now + 2 * windowMs) });
        return true;
      }
      if (count >= limit) return false;
      tx.set(
        ref,
        { count: count + 1, windowStart, expiresAt: new Date(windowStart + 2 * windowMs) },
        { merge: true },
      );
      return true;
    });
  }
}

export interface CreateRateLimitStoreOptions {
  env?: NodeJS.ProcessEnv;
  db?: RateLimitFirestore | null;
}

/**
 * Choose the rate-limit store from the environment.
 *
 * Firestore is opt-in via `RATE_LIMIT_STORE=firestore` and additionally requires
 * `RATE_LIMIT_HASH_SALT`. Any missing precondition logs why and falls back to the in-memory store,
 * so a misconfiguration degrades to the previous behavior rather than either crashing the server or
 * silently persisting weakly-hashed IPs.
 */
export function createRateLimitStore(options: CreateRateLimitStoreOptions = {}): RateLimitStore {
  const env = options.env ?? process.env;
  const requested = (env.RATE_LIMIT_STORE || "").trim().toLowerCase();

  if (requested !== "firestore") {
    if (env.RATE_LIMIT_REDIS_URL) {
      // Long-standing env name that never had an implementation. Say so rather than let an operator
      // believe limits are shared.
      logEvent({ event: "rate_limit_redis_not_implemented", level: "warn" });
    }
    return new MemoryRateLimitStore();
  }

  const salt = (env.RATE_LIMIT_HASH_SALT || "").trim();
  if (salt.length < MIN_SALT_LENGTH) {
    logEvent({ event: "rate_limit_firestore_salt_missing", level: "error" });
    return new MemoryRateLimitStore();
  }
  if (!options.db) {
    logEvent({ event: "rate_limit_firestore_db_unavailable", level: "error" });
    return new MemoryRateLimitStore();
  }

  logEvent({ event: "rate_limit_store_firestore_enabled", level: "info" });
  return new FirestoreRateLimitStore(
    options.db,
    salt,
    (env.RATE_LIMIT_COLLECTION || "").trim() || DEFAULT_RATE_LIMIT_COLLECTION,
  );
}
