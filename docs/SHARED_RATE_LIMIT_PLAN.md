# Shared Rate Limit — Production Plan

**Status:** Sprint 1 design · Sprint 2 implementation  
**Parent:** [`PRODUCTION_PLAN.md`](./PRODUCTION_PLAN.md)

Current rate limiting in `server.ts` uses **in-memory `Map` stores** per process. That is acceptable for single-instance dev but **not production-safe** behind horizontal scaling or restarts.

---

## Problem

| Issue | Effect |
|---|---|
| Per-instance memory maps | Limits reset per instance; effective cap = N × limit |
| Process restart | Counters reset |
| IP-only keys without `TRUST_PROXY` | Spoofable `X-Forwarded-For` in misconfigured deploys |
| No user-level keys on private routes | Authenticated abuse harder to throttle |

---

## Target architecture

```
Request → WAF (platform) → Express
              ↓
    verifyAppCheck (public)
              ↓
    SharedRateLimiter.check(key, limit, window)
              ↓
         Redis / Upstash
```

### Key design

| Endpoint class | Rate limit key |
|---|---|
| Public Quick Check analyze | `qc:analyze:{ip}` + optional `{appCheckAppId}` |
| Public file analyze | `qc:file:{ip}` |
| Community signal | `signal:{ip}` |
| Private analyze | `case:analyze:{uid}` |
| Private multimodal extract | `case:extract:{uid}` |

Use **sliding window** or **fixed window with TTL** in Redis.

---

## Interface (Sprint 2)

Create `src/lib/security/rateLimit.ts`:

```typescript
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; windowStart: number }>;
}

export function createRateLimiter(store: RateLimitStore) {
  return async function checkLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitResult> { /* ... */ };
}
```

Implementations:

- `MemoryRateLimitStore` — current behavior (dev/default)
- `RedisRateLimitStore` — production (`RATE_LIMIT_REDIS_URL`)

Factory:

```typescript
export function getRateLimitStore(): RateLimitStore {
  if (process.env.RATE_LIMIT_REDIS_URL) {
    return new RedisRateLimitStore(process.env.RATE_LIMIT_REDIS_URL);
  }
  return new MemoryRateLimitStore();
}
```

Recommended provider: **Upstash Redis** (serverless-friendly) or managed Redis on hosting platform.

---

## Production limits (initial)

Layer **platform WAF** (coarse) + **app limits** (fine):

| Route | Burst | Daily | Notes |
|---|---|---|---|
| `POST /api/quick-check/analyze` | 5 / 5 min | 15 / day | Align with current code; tune from metrics |
| `POST /api/quick-check/analyze-file` | 3 / 5 min | 10 / day | When public multimodal enabled |
| `POST /api/community/submit-signal` | 5 / 10 min | 10 / day | |
| `POST /api/cases/:id/analyze` | 10 / hour | 50 / day | Per `uid` |
| `POST /api/cases/:id/evidence/extract` | 5 / hour | 20 / day | Sprint 3 multimodal |

Return **429** with calm JSON; include `Retry-After` header when possible.

---

## IP extraction

Keep existing `getClientIp()` logic:

- `TRUST_PROXY=true` only when deployed behind known load balancer
- Normalize IPv6-mapped IPv4
- Document in [`PRODUCTION_ENV_CHECKLIST.md`](./PRODUCTION_ENV_CHECKLIST.md)

---

## Migration steps (Sprint 2)

1. Extract `makeDailyRateLimit` / `makeBurstRateLimit` logic into `rateLimit.ts` with store interface.
2. Add Redis store + env var.
3. Replace inline `Map` usage in `server.ts`.
4. Add integration test with mock store.
5. Deploy Redis; verify cross-instance counting in staging.
6. Add metrics: rate limit hits per route (no PII in logs).

---

## Failure modes

| Failure | Behavior |
|---|---|
| Redis unavailable | **Fail closed** for public routes (503) OR fail open with loud alert — **prefer fail closed** for cost-sensitive routes |
| Redis slow | Timeout 100ms; treat as limit exceeded for public analyze |

Document operator choice in deploy runbook.

---

## Sprint 1 deliverable

This plan satisfies Sprint 1. Implementation is Sprint 2.

---

_Last updated: 2026-06-21_
