# Vercel frontend deployment

**Architecture (Option A′):** Vercel hosts the static SPA (Vite build) and **rewrites `/api/*` to the Cloud Run backend** (`fraudcase-prod`). The browser stays same-origin to Vercel, so no CORS and no client code change; Vercel proxies API calls to Cloud Run, which is publicly invocable but **enforces its own Firebase auth on every route** (the app is the gatekeeper). Gemini runs server-side on Cloud Run via Vertex AI — never in the browser.

```
Browser ──(/api/*, Authorization: Firebase ID token)──► Vercel (static SPA + rewrite)
                                                          └─► Cloud Run fraudcase-prod (verifies token, owner-isolated)
```

See `vercel.json` for the build + rewrite config (the Cloud Run URL is public, not a secret).

## Vercel project setup
1. Import the GitHub repo into Vercel (framework auto-detects Vite; `vercel.json` pins `vite build` → `dist`).
2. Set **Environment Variables** (Production + Preview). These are the **public** Firebase web values (same as the local `.env`); they are inlined into the client bundle at build time:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_FIRESTORE_DATABASE_ID`
3. Deploy. Vercel gives a preview URL (e.g. `https://<project>.vercel.app`).

## Never put in Vercel
- **No** `GEMINI_API_KEY` / Vertex credentials (extraction is server-side on Cloud Run via ADC).
- **No** Firebase Admin / service-account JSON.
- **No** Supabase service-role key.
- Only the public `VITE_FIREBASE_*` values belong in the Vercel build env.

## Post-deploy (Firebase, required for sign-in)
Add the Vercel hostname(s) to:
- **Firebase Auth → Authorized domains** (e.g. `<project>.vercel.app` and any custom domain).
- The **web API key's HTTP-referrer allowlist** (so the browser's Firebase/Identity Toolkit calls aren't blocked).

## Custom domain (optional, you purchase/configure)
Pick one and add it as a Vercel domain, then add it to the two Firebase lists above. Suggestions (not purchased):
`fraudcasegh.com`, `fraudcasegh.app`, `getfraudcase.com`, `fraudcase.africa`, `fraudcase.app`, `usefraudcase.com`.

## Notes / limits
- Large evidence uploads proxy through Vercel; if very large files fail, the fallback is a direct-to-Cloud-Run upload path (not needed for typical small screenshots/PDFs).
- The Cloud Run service stays the source of truth for the API + extraction; Vercel is frontend/proxy only.
