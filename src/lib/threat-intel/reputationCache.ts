/** TTL cache for provider verdicts (in-memory; cache-first to control cost/latency). Pure + injectable clock. */
import { ProviderVerdict } from "./types";

interface Entry {
  verdict: ProviderVerdict;
  expiresAt: number;
}

export interface ReputationCache {
  get(key: string): ProviderVerdict | undefined;
  set(key: string, verdict: ProviderVerdict): void;
  size(): number;
}

export function createMemoryCache(now: () => number = () => Date.now()): ReputationCache {
  const store = new Map<string, Entry>();
  return {
    get(key) {
      const e = store.get(key);
      if (!e) return undefined;
      if (now() >= e.expiresAt) {
        store.delete(key);
        return undefined;
      }
      return e.verdict;
    },
    set(key, verdict) {
      const ttlMs = Math.max(0, verdict.cacheTtlSeconds) * 1000;
      store.set(key, { verdict, expiresAt: now() + ttlMs });
    },
    size() {
      return store.size;
    },
  };
}

/** Cache key for an indicator + provider. Uses the normalized value (no raw PII). */
export function cacheKey(provider: string, normalizedValue: string): string {
  return `${provider}::${normalizedValue}`;
}
