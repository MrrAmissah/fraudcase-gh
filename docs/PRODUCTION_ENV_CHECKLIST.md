# Production Environment Checklist

**Status:** Sprint 1  
**Parent:** [`PRODUCTION_PLAN.md`](./PRODUCTION_PLAN.md), [`ENV_SETUP.md`](./ENV_SETUP.md)

Use before staging deploy and public launch. Never commit real values.

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

---

## Firebase console

- [ ] Email/password auth enabled
- [ ] Firestore database created (custom ID if used)
- [ ] Storage bucket created, **not public**
- [ ] `firestore.rules` deployed from repo
- [ ] `storage.rules` deployed from [`STORAGE_RULES.md`](./STORAGE_RULES.md)
- [ ] App Check registered (Sprint 2)
- [ ] Authorized domains include production hostname

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
