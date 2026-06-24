# Production Environment Checklist

**Status:** Sprint 1  
**Parent:** [`PRODUCTION_PLAN.md`](./PRODUCTION_PLAN.md), [`ENV_SETUP.md`](./ENV_SETUP.md)

Use before staging deploy and public launch. Never commit real values. For staging, the Firebase Auth authorized domain and the web API-key HTTP referrer allowlist must match the staging hostname exactly before any browser sign-in or smoke test.

---

## Client (build-time — `VITE_*`)

| Variable | Required | Set in prod |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Yes | Firebase console |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase console |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase console |
| `VITE_FIREBASE_STORAGE_BUCKET` | Yes | Firebase console |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase console |
| `VITE_FIREBASE_APP_ID` | Yes | Firebase console |
| `VITE_FIREBASE_FIRESTORE_DATABASE_ID` | Yes | Firebase console |
| `VITE_APP_CHECK_ENABLED` | Sprint 2 | `true` |
| `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` | Sprint 2 | App Check provider |
| `VITE_CAPTCHA_SITE_KEY` | Sprint 2 | Turnstile/reCAPTCHA |

Staging and production builds must be built with the matching environment's `VITE_FIREBASE_*` values because these are bundled into the client. Do not promote a dev-built client bundle into staging or production.

---

## Server (runtime — secrets)

| Variable | Required | Source |
|---|---|---|
| `GEMINI_API_KEY` | Recommended | Secret Manager |
| `GEMINI_MODEL` | Optional | Default `gemini-3.5-flash` |
| `MULTIMODAL_EXTRACTION_ENABLED` | Sprint 3 | `false` by default; set `true` only when ready to enable private image/PDF extraction |
| `MULTIMODAL_EXTRACTION_TIMEOUT_MS` | Optional (S3) | Per-call extraction timeout; default 30000 |
| `ADMIN_EMAILS` | For admin | Secret Manager |
| `GOOGLE_APPLICATION_CREDENTIALS` | Or ADC | Runtime SA (preferred over JSON file) |
| `APP_URL` | Recommended | Deploy platform |
| `TRUST_PROXY` | Prod behind LB | `true` |
| `APP_CHECK_ENFORCE` | Sprint 2 | `true` in prod |
| `RATE_LIMIT_REDIS_URL` | Sprint 2 | Upstash/Redis |
| `CAPTCHA_SECRET_KEY` | Sprint 2 | Secret Manager |
| `CAPTCHA_ENFORCE` | Sprint 2 | `true` to enforce CAPTCHA |

`MULTIMODAL_EXTRACTION_ENABLED` must remain unset or `false` in production until the staging smoke test is clean and App Check/CAPTCHA, deployed Firestore/Storage rules, owner-isolation checks, billing/quota controls, and rollback readiness have been reviewed for that environment.

---

## Firebase console

- [ ] Email/password auth enabled
- [ ] Firestore database created (custom ID if used). If using the named database path, confirm the ID matches `ai-studio-36d6feb3-b3c2-4e2a-9c6b-46c7b67a02e9`; querying `(default)` can produce false-clean verification.
- [ ] Storage bucket created, **not public**
- [ ] `firestore.rules` deployed from repo
- [ ] `storage.rules` deployed from [`STORAGE_RULES.md`](./STORAGE_RULES.md)
- [ ] App Check registered (Sprint 2)
- [ ] Authorized domains include the staging hostname for staging and the production hostname for production
- [ ] Firebase web API-key HTTP referrer restrictions include only the intended staging/production hostnames

---

## GCP / billing

- [ ] Billing account linked
- [ ] Budget alerts at 50/80/100% ([`GEMINI_QUOTA_AND_BILLING.md`](./GEMINI_QUOTA_AND_BILLING.md))
- [ ] Gemini API quotas set
- [ ] Service account has minimum roles: Firebase Admin, Storage object admin (scoped)

---

## Deploy platform

- [ ] Health check configured (`GET /api/health`)
- [ ] `TRUST_PROXY=true` if using platform load balancer
- [ ] WAF / rate rules enabled
- [ ] Secrets injected at runtime (not baked in image)
- [ ] `secure_uploads/` not used in prod (GCS only)
- [ ] Rollback procedure documented ([`DEPLOYMENT_RUNBOOK.md`](./DEPLOYMENT_RUNBOOK.md) §8)

---

## Pre-deploy verification

```bash
npm run check:env
npm run check:multimodal-readiness
npm test
npm run lint
npm run build
```

Manual smoke ([`MANUAL_E2E_QA.md`](./MANUAL_E2E_QA.md) sections A–H).

---

## Post-deploy verification

- [ ] Sign up / sign in works
- [ ] User A cannot read User B case (403)
- [ ] Quick Check returns result; nothing in Firestore
- [ ] Rate limit returns 429 when exceeded (staging test)
- [ ] Admin non-allowlist gets 403
- [ ] Error monitoring receiving events

---

_Last updated: 2026-06-21_
