# Environment & Firebase/Gemini Setup

How to configure FraudCase GH for real Firebase Admin credentials and Gemini, for local
development and production. Run `npm run check:env` to see which variables are set (it never
prints values).

## Variables

### Client (build-time, `VITE_*`) — bundled into the browser app
These are **public by design** (Firebase web identifiers) and the code has hardcoded fallbacks, but
set them per-project for clarity:
| Variable | Purpose |
|----------|---------|
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Project id (also read by the Admin SDK) |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket (also read by the Admin SDK) |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM sender id |
| `VITE_FIREBASE_APP_ID` | App id |
| `VITE_FIREBASE_FIRESTORE_DATABASE_ID` | **Named** Firestore database id (not `(default)`) |

### Server (runtime) — secret; never sent to the client
| Variable | Required? | Purpose |
|----------|-----------|---------|
| `GEMINI_API_KEY` | Optional | Server-side Gemini analysis; **heuristic mock** used if unset |
| `ADMIN_EMAILS` | Optional | Comma-separated admin allowlist; **fail-closed** (no admins if unset) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Required* | Path to a service-account JSON for the Admin SDK |
| `NODE_ENV` | — | `production` switches the server to serve the built SPA |

\* *Required for persistence* unless you use ADC (`gcloud auth application-default login`) locally.

## Firebase Auth
- Enable **Email/Password** sign-in in Firebase Console → Authentication → Sign-in method.
- The client SDK (`src/lib/firebase/client.ts`) handles sign-up/in; the server verifies ID tokens
  with `firebase-admin` (`requireAuth` / `requireAdmin`).

## Firestore
- Uses a **named** database: `ai-studio-…` (see `VITE_FIREBASE_FIRESTORE_DATABASE_ID` and
  `src/lib/firebase/admin.ts`). Create/select that database in the Console.
- Collections: `cases` (owner-isolated) and `communitySignals` (server-only).
- Deploy `firestore.rules`. Note: today all access is server-mediated via the Admin SDK (which
  **bypasses** rules), so the rules are defense-in-depth — but deploy them so direct-client access
  is safe by default. `communitySignals` is `allow read, write: if false`.

## Cloud Storage
- Evidence files live under `users/{uid}/cases/{caseId}/evidence/{evidenceId}/{file}`.
- There is **no `storage.rules` file** in the repo yet — copy the recommended rules from
  [`STORAGE_RULES.md`](./STORAGE_RULES.md) into a `storage.rules` file and deploy. Keep the bucket
  private (no public access).
- In local dev without credentials, uploads fall back to a git-ignored `secure_uploads/` directory
  (`storageProvider: "local-dev"`); in production they go to Cloud Storage.

## Firebase Admin / ADC
The server uses the Admin SDK for Firestore + Storage. Provide credentials one of two ways:
- **Local**: `gcloud auth application-default login` (ADC), or set `GOOGLE_APPLICATION_CREDENTIALS`
  to a downloaded service-account JSON.
- **Production (Cloud Run / GCP)**: the runtime service account provides ADC automatically — no key
  file needed.
- Without credentials, the server boots and serves the SPA, but any Firestore/Storage operation
  fails (sign-in persistence, cases, uploads, analyze-persist, signals, admin).

## Gemini (`GEMINI_API_KEY`)
- Set it to enable real `gemini-2.5-flash` analysis (server-side only — never a client key).
- If unset, `analyzeFraudCase` logs a warning and returns a heuristic mock — the app still works
  end-to-end.

## `ADMIN_EMAILS`
- Comma-separated, case-insensitive: `ADMIN_EMAILS="you@example.com,admin@example.com"`.
- Fail-closed: empty/unset → no admins → the Community Signals dashboard returns 403 for everyone.

## Local development
```bash
npm install
# create .env from the template and fill values
cp .env.example .env
gcloud auth application-default login   # or set GOOGLE_APPLICATION_CREDENTIALS
npm run check:env                       # confirm what's set (no values printed)
npm run dev                             # http://localhost:3000
```

## Production deployment notes
- `npm run build` → `vite build` (SPA) + `esbuild` bundle → `dist/server.cjs`; `npm start` runs it
  with `NODE_ENV=production`.
- Inject `GEMINI_API_KEY` and `ADMIN_EMAILS` from a secret manager, not `.env`.
- Use the runtime service account for Admin credentials (no key file in the image).
- Deploy `firestore.rules` and a `storage.rules` (from `STORAGE_RULES.md`).

## What must NEVER be committed
- `.env` / `.env.local` (git-ignored).
- Service-account JSON keys (`*.serviceAccount.json`, `service-account*.json`,
  `firebase-adminsdk*.json` — git-ignored).
- `secure_uploads/` (local evidence cache — git-ignored).
- Real `GEMINI_API_KEY` or any private credential. The `VITE_FIREBASE_*` values and
  `firebase-applet-config.json` are public Firebase identifiers and are safe to commit.
