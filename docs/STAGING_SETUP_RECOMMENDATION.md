# Cloud Run Staging Setup Recommendation

**Status:** Recommendation only. Nothing in here has been deployed or provisioned. No production enablement until the issue #19 staging smoke test passes.
**Date:** 2026-06-24
**Applies to:** `main` at or after the `staging/cloud-run-readiness` changes (runtime `PORT`, `FIRESTORE_DATABASE_ID` override, container scaffold, env template).
**Related:** [`MULTIMODAL_STAGING_SMOKE_TEST.md`](./MULTIMODAL_STAGING_SMOKE_TEST.md), [`DEPLOYMENT_RUNBOOK.md`](./DEPLOYMENT_RUNBOOK.md), [`PRODUCTION_ENV_CHECKLIST.md`](./PRODUCTION_ENV_CHECKLIST.md), [`GEMINI_QUOTA_AND_BILLING.md`](./GEMINI_QUOTA_AND_BILLING.md), [`STORAGE_RULES.md`](./STORAGE_RULES.md).

## Architecture (why the recommendation follows)

`npm run build` produces one artifact: `dist/server.cjs` (esbuild bundle of `server.ts`) plus the Vite client in `dist/`. `npm start` runs `node dist/server.cjs`, which binds a port and, in production, serves **both the static SPA and the `/api/*` routes from the same process**. This is a single long-running container workload, not a serverless-functions app. Firebase Admin uses Application Default Credentials (no service-account JSON key; org policy blocks key creation).

## 1. Recommended target: Google Cloud Run

Primary: **Cloud Run**. Close alternative: **Firebase App Hosting** (Cloud Run plus Firebase-managed GitHub deploy via `apphosting.yaml`).

**Decisive reason: ADC.** On Cloud Run / App Hosting the runtime service account *is* ADC with zero key material, which matches the org policy that blocks service-account JSON keys. Off-GCP (Vercel) Firebase Admin would need a SA key (blocked) or Workload Identity Federation (heavy). Cloud Run also gives Secret Manager, per-environment vars, Cloud Logging for the privacy/log review, a separate staging service, and one-click rollback to a previous revision.

### Why not the others
- **Vercel:** possible but not preferred. It fights the port-binding single-server shape and the ADC story is poor off-GCP. Avoid for this app.
- **Firebase Hosting + separate Express backend:** an unnecessary split. One server already serves SPA + API; Hosting is static-only and would still need a backend (Cloud Run/Functions) behind it.

## 2. Two deployment facts that are load-bearing

- **`NODE_ENV=production` must be set.** Cloud Run does not set it by default. Without it the server mounts the Vite dev middleware instead of serving `dist/`, and the upload route flips to the local-disk `secure_uploads/` fallback on ephemeral storage (a silent privacy regression). The container scaffold (`Dockerfile`) sets it; if you deploy via buildpacks/source instead of the Dockerfile, set `NODE_ENV=production` on the service.
- **Port.** The server now honors `process.env.PORT` (Cloud Run injects it) and falls back to 3000 for local dev. No container-port override is required; the default works.

## 3. Identity, secrets, and the web key

- **Server identity:** the Cloud Run runtime service account provides ADC. Grant minimum roles: Firestore/Datastore user, Storage object admin scoped to the staging bucket, and Firebase Admin as needed. Do not create or mount a service-account JSON key. Leave `GOOGLE_APPLICATION_CREDENTIALS` unset.
- **Gemini key:** `GEMINI_API_KEY` is the only true server secret. Store it in Secret Manager and mount it as a Cloud Run secret. Never a build arg, never in the client, never the web API key.
- **Web API key:** the `VITE_FIREBASE_API_KEY` is public-by-design (inlined into the client bundle) but should remain **restricted**: HTTP-referrer allowlist limited to the intended hostnames, and API restrictions limited to Firebase/Identity Toolkit. Do not add the Generative Language (Gemini) API to the web key; Gemini is called server-side with `GEMINI_API_KEY`.

## 4. Firebase / GCP configuration (manual console, you)

- **Staging hostname:** the Cloud Run service URL or a custom staging domain.
- **Firebase Auth Authorized domains:** add the staging hostname (else sign-in/token issuance fails).
- **Web API key HTTP-referrer allowlist:** add the staging hostname.
- **Storage bucket:** create, keep not public, deploy Storage rules ([`STORAGE_RULES.md`](./STORAGE_RULES.md)).
- **Firestore database id caveat:** the server binds a NAMED database. It defaults to `ai-studio-36d6feb3-b3c2-4e2a-9c6b-46c7b67a02e9`, and can now be overridden with the `FIRESTORE_DATABASE_ID` env var (empty never silently selects `(default)`). For a separate staging project, either create a Firestore database with that exact id, or set `FIRESTORE_DATABASE_ID` (server) and `VITE_FIREBASE_FIRESTORE_DATABASE_ID` (client build) to the staging database id. Deploy `firestore.rules`.
- **Budget/quota guard:** GCP budget alerts at 50/80/100% and a conservative Generative Language (Gemini) quota.
- **Log access:** Cloud Logging reachable for the privacy/log-leak review.

## 5. Project isolation (recommended)

Use a **separate staging Firebase/GCP project**, not "same project + isolated data." Same-project staging shares the Firestore database, bucket, and Gemini quota/billing with dev/prod, which defeats the isolation the smoke test exists to prove and shares the blast radius for a test that makes real Gemini calls and real writes. The known cost of a separate project is the named-database step above (create the database with the id, or use the new `FIRESTORE_DATABASE_ID` override).

## 6. Environment variables (names only; values never committed)

See [`.env.staging.example`](../.env.staging.example) for the full grouped template. Summary:
- **Frontend build-time (`VITE_FIREBASE_*`):** public, inlined at build; set in the staging build/CI env, not Secret Manager.
- **Backend runtime:** `NODE_ENV=production`, `TRUST_PROXY=true`, optional `APP_URL`; `PORT` is auto-injected.
- **Admin/server identity:** none as env on Cloud Run (ADC); `GOOGLE_APPLICATION_CREDENTIALS` unset; optional `FIRESTORE_DATABASE_ID`.
- **Gemini:** `GEMINI_API_KEY` (Secret Manager), optional `GEMINI_MODEL`, `MULTIMODAL_EXTRACTION_TIMEOUT_MS`.
- **Feature flags (off):** `MULTIMODAL_EXTRACTION_ENABLED=false`, `APP_CHECK_ENFORCE` off, `CAPTCHA_ENFORCE` off, `RATE_LIMIT_REDIS_URL` unset.

## 7. Exact implementation order

1. Choose Cloud Run staging.
2. Create the separate staging GCP/Firebase project.
3. Create the Firestore database (matching id or set the override); create + secure the bucket; deploy `firestore.rules` + Storage rules.
4. Grant the runtime service account its IAM roles; put `GEMINI_API_KEY` in Secret Manager.
5. Build the client with staging `VITE_FIREBASE_*` values (CI or `docker build --build-arg`).
6. Deploy `main` with `NODE_ENV=production` and `MULTIMODAL_EXTRACTION_ENABLED` off.
7. Confirm `GET /api/health` returns 200.
8. Add the staging hostname to Auth authorized domains + the API-key referrer allowlist; confirm sign-in works.
9. Confirm disabled-extraction behavior (extract route 503) and no log leak (the flag-off baseline, smoke-test Phase 1).
10. Only then enable `MULTIMODAL_EXTRACTION_ENABLED=true` in staging only and redeploy/restart.
11. Run the issue #19 smoke test ([`MULTIMODAL_STAGING_SMOKE_TEST.md`](./MULTIMODAL_STAGING_SMOKE_TEST.md) Phases 3 to 6).

## 8. What is automatable later vs manual

**Automatable (a follow-up change can draft these; none deploy anything):** the container scaffold (done: `Dockerfile`, `.dockerignore`), the env template (done: `.env.staging.example`), a Node pin to match CI, and a staging deploy GitHub workflow (committed but not triggered) once the staging project, service name, region, runtime service account, secret names, and deploy permissions are decided.

**Manual only (requires cloud credentials/console; an agent must not do these):** create the staging project; create the named Firestore database; create/secure the bucket and deploy rules; set Auth authorized domains, API-key referrer allowlist, and API restrictions; grant the runtime SA IAM roles; put `GEMINI_API_KEY` in Secret Manager; set budget alerts + Gemini quota; run the deploy; flip the flag.

## 9. Hard-stop conditions

Stop and report (do not improvise) on any of:
- Missing staging host / service not reachable.
- Missing or wrong Firebase Auth authorized domain (sign-in fails).
- API-key referrer error (`requests-from-referer ... are blocked`).
- Admin credential failure (ADC / permission denied on Firestore or Storage).
- Gemini quota/billing error (429, `multimodal_extract_error`, or any budget alert).
- Wrong Firestore database (querying `(default)` or a DB-id mismatch: false-clean reads or write failures).
- Any privacy/logging leak (raw OCR/phone/`rawValue`/Gemini prompt/response/signed URL/token in logs or persisted docs).
- `NODE_ENV` not `production`, or the container failing its health check.

## 10. Gate

`MULTIMODAL_EXTRACTION_ENABLED` stays unset/false in production until the issue #19 staging smoke test is clean and the production hardening gates (App Check/CAPTCHA, deployed rules, owner-isolation checks, billing/quota, rollback) are reviewed for that environment. No production enablement before then.

_Last updated: 2026-06-24_
