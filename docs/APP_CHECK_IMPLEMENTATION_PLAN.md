# App Check Implementation Plan

**Status:** Sprint 1 design · Sprint 2 implementation  
**Parent:** [`PRODUCTION_PLAN.md`](./PRODUCTION_PLAN.md)

Firebase App Check attests that requests to custom backends originate from the genuine FraudCase GH app, reducing bot abuse on public endpoints.

---

## Scope

### Phase 1 — Enforce on public routes (Sprint 2)

| Route | Method | Priority |
|---|---|---|
| `/api/quick-check/analyze` | POST | P0 |
| `/api/quick-check/analyze-file` | POST | P0 |
| `/api/community/submit-signal` | POST | P0 |
| Future public multimodal routes | POST | P0 (before launch) |

### Phase 2 — Optional on authenticated routes (Sprint 2+)

Private routes already require Firebase Auth. App Check adds defense-in-depth against token theft from non-genuine clients. Enable after public rollout stabilizes.

---

## Client integration

1. Enable App Check in Firebase console for the web app.
2. Choose provider:
   - **reCAPTCHA Enterprise** (recommended for web production)
   - **reCAPTCHA v3** (simpler; tune score threshold)
3. Install / configure in `src/lib/firebase/client.ts`:

```typescript
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

// After Firebase app init, before API calls:
if (import.meta.env.VITE_APP_CHECK_ENABLED === "true") {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}
```

4. Attach token on public API calls in `quickCheckClient.ts` and signal submit:

```typescript
import { getToken } from "firebase/app-check";

const appCheckToken = await getToken(appCheck, /* forceRefresh */ false);
headers["X-Firebase-AppCheck"] = appCheckToken.token;
```

Note: App Check can run without user sign-in for public endpoints.

---

## Server verification

Add middleware in `server.ts` (Sprint 2):

```typescript
import { getAppCheck } from "firebase-admin/app-check";

async function verifyAppCheck(req, res, next) {
  if (process.env.APP_CHECK_ENFORCE !== "true") {
    return next(); // dev/local passthrough
  }
  const token = req.header("X-Firebase-AppCheck");
  if (!token) {
    return res.status(401).json({ error: "App Check token required." });
  }
  try {
    await getAppCheck().verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid App Check token." });
  }
}
```

Apply **before** rate limiters on public routes:

```typescript
app.post("/api/quick-check/analyze", verifyAppCheck, quickCheckBurstLimit, quickCheckRateLimit, ...);
```

### Replay protection (optional, sensitive routes)

Firebase Admin SDK supports replay protection for high-value endpoints. Enable for `/api/quick-check/analyze-file` when multimodal public flow ships.

---

## Environment variables

| Variable | Scope | Notes |
|---|---|---|
| `VITE_APP_CHECK_ENABLED` | Client | `true` in staging/production |
| `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` | Client | Public site key |
| `APP_CHECK_ENFORCE` | Server | `false` dev, `true` prod |
| `RECAPTCHA_ENTERPRISE_SECRET` | Server | If verifying CAPTCHA separately |

---

## Rollout strategy

1. **Monitor mode (Sprint 2 week 1):** Log App Check verification failures without blocking (`APP_CHECK_ENFORCE=false`, log only).
2. **Enforce staging (week 2):** `APP_CHECK_ENFORCE=true` on staging; run E2E.
3. **Enforce production:** Enable after false-positive rate acceptable.

---

## CAPTCHA complement

App Check ≠ CAPTCHA for all abuse. Pair with **Cloudflare Turnstile** or reCAPTCHA on public form submit for human attestation on:

- Quick Check analyze (button click)
- Community signal submit

Turnstile server verify runs in same middleware chain after App Check.

---

## Testing

| Test | Expected |
|---|---|
| Missing `X-Firebase-AppCheck` when enforced | 401 |
| Invalid token | 401 |
| Valid token from registered app | 200 (subject to rate limits) |
| `APP_CHECK_ENFORCE=false` | Passes without token (dev) |

---

## Sprint 1 deliverable

This document satisfies Sprint 1 "App Check design and initial implementation plan." Code lands in Sprint 2.

---

_Last updated: 2026-06-21_
