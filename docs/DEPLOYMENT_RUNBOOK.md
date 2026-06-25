# Deployment and Rollback Runbook

**Status:** Sprint 2  
**Parent:** `PRODUCTION_PLAN.md`  
**Related:** `PRODUCTION_ENV_CHECKLIST.md`, `APP_CHECK_IMPLEMENTATION_PLAN.md`, `SHARED_RATE_LIMIT_PLAN.md`, `GEMINI_QUOTA_AND_BILLING.md`

Operational runbook for deploying FraudCase GH and rolling back safely. Never commit real secrets; inject them at runtime (Secret Manager / platform env).

---

## 1. Build artifacts

```bash
npm ci
npm test
npm run lint
npm run build   # vite build (client) + esbuild bundle -> dist/server.cjs
npm start        # runs node dist/server.cjs
```

The server binds `0.0.0.0:3000`. Client `VITE_*` values are inlined at build time, so the build environment must have the production `VITE_FIREBASE_*` values set.

---

## 2. Pre-deploy checklist

Run the gate in `PRODUCTION_ENV_CHECKLIST.md` and confirm:

- `npm run check:env`, `npm test`, `npm run lint`, `npm run build` all pass.
- Secrets are injected at runtime, not baked into the image.
- `firestore.rules` and Storage rules are deployed (see §6).
- Billing alerts and Gemini quotas are configured (see §7).

---

## 3. Sprint 2 hardening controls (default-off, enable per environment)

These shipped behind flags so dev and current production behavior are unchanged until enabled. Enable in staging first.

| Control | Enable with | Prerequisite before enabling |
|---|---|---|
| **App Check** (`verifyAppCheck` on public routes) | `APP_CHECK_ENFORCE=true` | Client must attach `X-Firebase-AppCheck` (see App Check plan) and reCAPTCHA Enterprise/site key provisioned. Enabling server-side without the client will 401 all public routes. |
| **CAPTCHA / Turnstile** (`verifyCaptcha` on public routes) | `CAPTCHA_ENFORCE=true` + `CAPTCHA_SECRET_KEY` | Client must attach `X-Captcha-Token`; provision Turnstile/reCAPTCHA keys (`VITE_CAPTCHA_SITE_KEY`, `CAPTCHA_SECRET_KEY`). |
| **Shared rate limiter** | `RATE_LIMIT_REDIS_URL` | Redis/Upstash provisioned. NOTE: the Redis store is not yet implemented; until then the app logs `rate_limit_redis_not_implemented` and uses the in-memory store (per-instance). Multi-instance deploys are not truly shared until the Redis store lands. |
| **Request/response timeouts** | always on | None. Per-route 20s timeout on public analyze routes; server `requestTimeout=120s`, `headersTimeout=65s`. |

Rollout order (per environment): monitor → staging enforce → production enforce, watching false-positive and 401/403 rates.

---

## 4. Structured logging

The server emits single-line JSON events (see `src/lib/observability/logger.ts`). Events never include request bodies, evidence text, tokens, keys, or raw Firebase/Gemini errors (only `errorType`). Ship stdout to the platform log aggregator. Useful event names: `quick_check_analyze`, `analyze_case`, `rate_limit_store_error`, `rate_limit_redis_not_implemented`, `unhandled_rejection`, `server_boot_failed`.

---

## 5. Health check

- Endpoint: `GET /api/health` (public, no auth).
- Returns `{ "status": "ok", "timestamp": <ISO>, "uptimeSeconds": <int> }`.
- Configure the platform liveness/readiness probe against this path. It performs no DB or upstream calls and leaks no env/version/secret data.

---

## 6. Firebase Security Rules and Storage

- Deploy `firestore.rules` from the repo (cases owner-isolated; `communitySignals` denied to clients; `users` own-uid).
- Deploy Storage rules from [`STORAGE_RULES.md`](./STORAGE_RULES.md); bucket must not be public.
- Post-deploy, verify cross-owner read is denied (see §9) and a public object URL is denied.

These rules, not key secrecy, are the data boundary. The Firebase web API key is public-by-design and restricted (website referrers + Firebase APIs only; Gemini API excluded).

---

## 7. Gemini billing and quota

Per `GEMINI_QUOTA_AND_BILLING.md`:

- GCP budget alerts at 50/80/100%.
- Conservative daily Gemini quotas at launch.
- Monitor 429s and analyze latency. `GEMINI_API_KEY` from Secret Manager only; never client-exposed.

---

## 8. Rollback

1. Identify the last known-good release (commit SHA / image tag) that was green in CI and verified post-deploy.
2. Redeploy that artifact (platform "rollback to previous revision" or redeploy the prior image tag).
3. If a flag enablement caused the incident (App Check / CAPTCHA false-positives, Redis store error), first try disabling the flag (`APP_CHECK_ENFORCE=false` / `CAPTCHA_ENFORCE=false` / unset `RATE_LIMIT_REDIS_URL`) and restart, before a full rollback.
4. Confirm `GET /api/health` returns `ok` and run §9.
5. Record the incident: trigger, action, time-to-recover.

No data migrations are introduced in Sprint 2, so rollback is artifact/flag-only (no schema reversal needed).

---

## 9. Post-deploy verification

- [ ] `GET /api/health` returns `status: ok`.
- [ ] Sign up / sign in works.
- [ ] User A cannot read User B's case (403).
- [ ] Quick Check returns a result; nothing written to Firestore.
- [ ] Rate limit returns 429 when exceeded (staging).
- [ ] Admin non-allowlist gets 403.
- [ ] Structured log events arriving in the aggregator (no sensitive content).
- [ ] If App Check/CAPTCHA enforced: a request without the token is rejected; a genuine client succeeds.

---

_Last updated: 2026-06-22_
