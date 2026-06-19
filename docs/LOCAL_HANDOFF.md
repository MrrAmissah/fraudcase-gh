# FraudCase GH — Local Handoff Report

_Audit date: 2026-06-19 · Scope: inspect, verify, document. No feature changes made._

FraudCase GH is an AI-assisted fraud-evidence organizer for Ghana. Users collect suspicious
messages, screenshots, URLs, receipts, and documents into private, owner-isolated case
workspaces, then run AI-assisted risk analysis, evidence timelines, readiness checklists, and
report previews.

---

## 1. Current Architecture

**Single-process fullstack app**: one Express server (`server.ts`) hosts the JSON API *and*
mounts Vite as middleware in dev (serves the React SPA from the same origin on port 3000). In
production the same server serves the static `dist/` build. There is no separate API gateway —
the React app calls same-origin `/api/*` routes.

```
Browser (React 19 SPA, Vite, Tailwind v4)
        │  fetch /api/*  with  Authorization: Bearer <Firebase ID token>
        ▼
Express server (server.ts, port 3000)
        │  requireAuth → adminAuth.verifyIdToken()  → req.user.uid
        │  every route re-checks  caseData.ownerId === req.user.uid
        ├──► Firestore (Admin SDK, named DB "ai-studio-…")     ← case + evidence docs
        ├──► Cloud Storage (Admin SDK bucket)                  ← evidence file bytes
        ├──► Local disk  ./secure_uploads/<uid>/<caseId>/…     ← UNCONDITIONAL copy (see gaps)
        └──► Gemini (@google/genai, gemini-3.5-flash)          ← analysis; mock fallback if no key
```

### Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6, TypeScript ~5.8, Tailwind CSS v4, `lucide-react`, `motion` |
| Backend | Node + Express 4, `tsx` (dev), `esbuild` bundle → `dist/server.cjs` (prod) |
| Auth | Firebase Authentication (email/password), client SDK + `firebase-admin` token verification |
| Database | Cloud Firestore via **Admin SDK** (named database, not `(default)`) |
| File storage | Firebase Cloud Storage via Admin SDK, with an always-on local-disk copy |
| AI | Google Gemini (`@google/genai`) with a heuristic mock fallback |
| Uploads | `multer` memory storage, 10 MB limit |

### Key files (verified locations)
| Concern | File |
|---------|------|
| App entry (SPA) | `src/main.tsx` → `src/App.tsx` (view-state router, not React Router) |
| Server entry / all API routes | `server.ts` |
| Firebase **client** init | `src/lib/firebase/client.ts` |
| Firebase **admin** init | `src/lib/firebase/admin.ts` |
| Auth context (`useAuth`) | `src/lib/firebase/auth.ts` |
| API client (fetch + token) | `src/lib/firebase/firestore.ts` |
| Upload/download logic | `server.ts` (`/evidence/upload`, `/evidence/:id/file`) + `addEvidenceFile` in `firestore.ts` |
| Redaction utility | `src/lib/security/redaction.ts` (canonical); `src/lib/utils/redaction.ts` (legacy wrapper) |
| Gemini analysis | `src/lib/gemini/analyzeFraudCase.ts` (+ `fraudCasePrompt.ts`, `fraudCaseSchema.ts`) |
| Case detail page | `src/pages/CaseDetailPage.tsx` |
| Report page | `src/pages/ReportPage.tsx` → `src/components/ReportPreview.tsx` |
| BrandLogo component | `src/components/BrandLogo.tsx` (self-contained SVG, unique gradient IDs) |
| Firestore security rules | `firestore.rules` |
| Evidence input UI | `src/components/EvidenceInput.tsx` |

---

## 2. How to Run Locally

```bash
npm install        # 431 packages; package manager is npm (only package-lock.json)
npm run dev        # tsx server.ts → http://localhost:3000
```

Verification status (all green as of this audit):
- `npm run lint` (`tsc --noEmit`) → **passes**, exit 0
- `npm run build` (vite build + esbuild bundle) → **passes**, exit 0 (emits `dist/`)
- `npm run dev` → server boots, `GET /` → **HTTP 200**
- `GET /api/cases` with no token → **HTTP 401** (auth guard wired correctly)

Other scripts: `npm start` (runs the prod build `dist/server.cjs`), `npm run clean` (`rm -rf dist`).

> **Important runtime prerequisite.** The Express server uses the Firebase **Admin SDK**, which
> needs Google **Application Default Credentials (ADC)** or a service-account key. In this
> environment ADC is **absent** (`~/.config/gcloud/application_default_credentials.json` missing,
> no `GOOGLE_*` env vars). The server still boots and serves the SPA, but any route that touches
> Firestore/Storage (create case, list cases, upload, analyze-persist) will **fail until admin
> credentials are configured**. See §5.

---

## 3. Environment Variables

`.env` exists and is git-ignored (`.env*` with `!.env.example`); `.env.example` is committed.
`.env` currently contains **only the 7 public Firebase client values**:

| Variable | Purpose | Sensitive? |
|----------|---------|-----------|
| `VITE_FIREBASE_API_KEY` | Firebase web identifier | No — public by design |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth domain | No |
| `VITE_FIREBASE_PROJECT_ID` | Project ID (also read by Admin SDK) | No |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket (also read by Admin SDK) | No |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID | No |
| `VITE_FIREBASE_APP_ID` | App ID | No |
| `VITE_FIREBASE_FIRESTORE_DATABASE_ID` | Named Firestore DB ID | No |

**Not present, needed for full functionality:**
- `GEMINI_API_KEY` — **optional**. Without it, `analyzeFraudCase` logs a warning and returns a
  heuristic **mock** analysis. With it, real `gemini-3.5-flash` calls run server-side.
- **Firebase Admin credentials** — **required for persistence.** Provide ADC
  (`gcloud auth application-default login`) or set `GOOGLE_APPLICATION_CREDENTIALS` to a
  service-account JSON for project `stellar-perigee-498907-c4`. The service-account key is a real
  secret — must **never** be committed.

---

## 4. Implemented Features (verified in code)

- **Email/password auth** — real Firebase Auth via `AuthProvider`/`useAuth`; `onAuthStateChanged`
  session tracking; ID-token attached to every API call (force-refreshed).
- **Owner-isolated cases** — every case carries `ownerId` = verified Firebase UID; **every** route
  re-checks ownership (`403` on mismatch). Client-supplied owner IDs are ignored.
- **Firestore persistence** — real Admin SDK reads/writes replaced in-memory state. Cases sorted
  in-memory to avoid a composite index.
- **CRUD** — create/list/get/update (PUT+PATCH)/delete cases; add/list/delete evidence; demo-seed.
- **Evidence file upload** — `multer` memory storage, 10 MB cap, extension **and** MIME allowlist
  (png/jpg/jpeg/webp/pdf/txt/csv/json/html), filename sanitization (path-traversal safe),
  uid-isolated storage path `users/{uid}/cases/{caseId}/evidence/{evidenceId}/{file}`.
- **Authenticated download proxy** — `/evidence/:id/file` streams from GCS (local-disk fallback),
  with `Content-Security-Policy: default-src 'none'; sandbox`, `X-Content-Type-Options: nosniff`,
  forced `attachment` disposition for non-images, and HTML coerced to `text/plain`.
- **Redaction guard** — `redactPIIAndSecrets` masks GH phone numbers, emails, cards/wallets, bank
  accounts, Ghana Card, API keys/secrets, OTP/PIN. Applied **client-side** (preview + toggle in
  `EvidenceInput`) **and** re-applied **server-side** to `originalText`. AI analysis prefers
  `redactedText` over `originalText`.
- **AI analysis** — structured Gemini call with response schema; rich heuristic mock fallback
  (Ghana-specific scam categories: fake delivery, fake investment, payment dispute, phishing).
- **UI** — landing, dashboard + stats, new-case form, case detail (evidence vault + analysis
  panels), report preview, auth screen, reusable `BrandLogo`. Forensic light theme (navy / cyan /
  amber / red-for-critical).
- **Firestore rules** — owner-isolated read/write, `ownerId` immutable on update.

---

## 5. Known Gaps & Risks

**Runtime / environment**
- **No Admin credentials locally (ADC absent).** Persistence, auth-token verification against the
  project, upload, and analyze-persist will error until ADC or a service-account key is set. The
  app boots and the SPA renders regardless. *This is a configuration gap, not a code defect.*
- End-to-end persistence/upload was **not** verifiable in this environment (no credentials, no way
  to mint a real ID token). The code paths are **real, not mocked** — but unverified at runtime here.

**Security — upload/download/redaction (the next phase)**
- **`secure_uploads/` is NOT git-ignored.** The upload handler writes every file to local disk, so
  a future `git add .` could commit raw user evidence (PII) into history. No live leak yet (nothing
  uploaded locally). **#1 hardening item.**
- **Local-disk copy is always-on, not a fallback.** `server.ts` step 2 writes to `secure_uploads/`
  unconditionally; `gcsSuccess` is set but never read. On Cloud Run this disk is ephemeral and not
  a real backup — it's just plaintext PII-at-rest. Should be conditional or removed.
- **Uploaded file *bytes* are never redacted.** Redaction only touches the `originalText` string.
  Raw `.txt/.csv/.json/.html` contents (which the client even reads into `originalText`) persist
  **unredacted** in GCS and on local disk. Central to the redaction-hardening phase.
- **Raw `originalText` is stored alongside `redactedText`.** Redaction protects what goes to the AI,
  not what is stored at rest. Acceptable by design (original evidence) but should be explicit.
- **MIME is trusted, not verified.** Validation relies on client-declared extension + MIME; no
  magic-byte/content sniffing. Download-side mitigations (attachment + CSP + nosniff + html→text)
  reduce stored-XSS risk but content validation would harden further.
- **App Check not enabled.** `/analyze` (which can call paid Gemini) is unprotected from automated
  abuse beyond auth.
- **Multer size-limit errors aren't handled cleanly** — a >10 MB upload throws into the generic
  handler → `500` instead of a friendly `400`.

**Architecture framing**
- **Security rests entirely on the Express layer.** The Admin SDK **bypasses Firestore rules**, so
  `firestore.rules` is effectively dormant for the current access path (clients never touch
  Firestore directly). There is **no `storage.rules`** in the repo at all. If direct-client access
  is ever added, both rule sets become load-bearing and must be hardened first.

**Secrets**
- **No real secrets exposed.** `firebase-applet-config.json` and the `VITE_FIREBASE_*` values are
  public-by-design Firebase identifiers shipped in the client bundle. No `GEMINI_API_KEY` and no
  service-account JSON exist anywhere in the repo. `.env` is git-ignored.

**Housekeeping**
- Prod JS bundle is ~950 KB (>500 KB Vite warning) — code-splitting is a later optimization.
- `npm install` reports 6 moderate advisories and skipped some install scripts (esbuild/fsevents)
  under the sandbox; neither blocks `dev` or `build` (both verified green).

---

## 6. Next Recommended Phase

**Evidence upload / download / redaction hardening** — confirmed as the right next step; the gaps
above *are* that phase. Detailed, ordered build plan in [`NEXT_STEPS.md`](./NEXT_STEPS.md).

Explicitly **deferred** (per current direction): Public Quick Check, PDF engine in `ReportPreview`
(still `window.print()`), Next.js migration, UI redesign, and any change to the BrandLogo system.
