# FraudCase GH — Architecture Overview

This document describes the components of FraudCase GH and how requests flow through them. It is accurate to the implementation in `server.ts` and `src/`.

---

## High-level shape

FraudCase GH is a **single full-stack service**. One Express server (`server.ts`) both:

1. Exposes the JSON API under `/api/*`, and
2. Serves the React client — via **Vite middleware in development** and the **static `dist/` build + bundled `dist/server.cjs`** in production.

It binds to port `3000`.

```
                          ┌─────────────────────────────────────────────┐
                          │                Browser (SPA)                 │
                          │  React 19 + Vite + Tailwind + lucide/motion  │
                          │  Firebase Web SDK (client auth)              │
                          └───────────────┬─────────────────────────────┘
                                          │ HTTPS
             Firebase ID token  ──────►   │  Authorization: Bearer <token>
                                          ▼
                          ┌─────────────────────────────────────────────┐
                          │           Express server (server.ts)         │
                          │  • /api/* routes                             │
                          │  • requireAuth / requireAdmin middleware     │
                          │  • redaction + file validation               │
                          │  • analyzeFraudCase (Gemini + fallback)      │
                          │  • serves the React client (Vite/static)     │
                          └───┬───────────────┬───────────────┬─────────┘
                              │               │               │
                              ▼               ▼               ▼
                   Firebase Admin SDK   Google Gemini   (multer upload buffer)
                   via ADC                @google/genai
                     ├─ Auth (verifyIdToken)
                     ├─ Firestore (cases, community signals)
                     └─ Cloud Storage (evidence files)
```

---

## Components

### React / Vite client (`src/`)
- React 19 + TypeScript SPA, built with Vite 6 and styled with Tailwind CSS 4.
- Uses the **Firebase Web SDK** for client-side authentication (email/password). On sign-in the client holds a Firebase **ID token** and attaches it as `Authorization: Bearer <token>` on calls to `/api/*` (see `src/lib/firebase/firestore.ts` / auth helpers).
- Key UI: landing + Quick Check, auth page, case dashboard and detail, `ExtractedEntitiesTable`, `SuspiciousIndicators`, `RiskScoreCard`, `ReportPreview`, `QuickCheckResultCard`, and the admin signal review drawer.
- Animations via `motion`; icons via `lucide-react`.

### Express backend (`server.ts`)
- Express 4, run with `tsx` in development and bundled to `dist/server.cjs` with `esbuild` for production.
- Hosts all `/api/*` routes, the authorization middleware, redaction, file validation, upload handling (`multer`, in-memory), and the analysis orchestration.
- Also mounts Vite (dev) or serves the static client (prod), so the whole app is one process.

### Firebase Auth
- Provider of record for accounts (email/password). Passwords are handled entirely by Firebase; the app never sees or stores them.
- The server verifies every protected request with `adminAuth.verifyIdToken(token)` and derives the user's `uid`/`email` from the decoded token (`requireAuth`, `requireAdmin`).

### Firestore
- Stores `cases` (each with `ownerId`, embedded `evidenceItems`, and the `analysis` result) and the community-signals collection.
- Accessed through a custom database id (`getFirestore(app, "<database-id>")`) via the Admin SDK, with `ignoreUndefinedProperties` enabled.
- Owner isolation is enforced at query time (`where("ownerId", "==", uid)`) and re-checked on every case-scoped operation.

### Cloud Storage
- Stores uploaded evidence files under a per-user namespace: `users/{uid}/cases/{caseId}/evidence/{evidenceId}/{safeFileName}`.
- A clearly-marked **dev-only local fallback** (`secure_uploads/{uid}/…`, `provider=local-dev`) is used when Cloud Storage credentials are unavailable, so local development still works.
- File bytes are served back through an authenticated, ownership-checked endpoint (not via public URLs).

### Firebase Admin SDK
- Initialized in `src/lib/firebase/admin.ts` with `initializeApp({ projectId, storageBucket })` and **no explicit credential** — so it resolves **Application Default Credentials** automatically (env var → `gcloud` ADC file → metadata server).
- Provides `adminAuth`, `adminDb` (Firestore), and `adminStorage`.

### Gemini API
- Called from `src/lib/gemini/analyzeFraudCase.ts` via `@google/genai`, model `gemini-2.5-flash`, with `responseMimeType: application/json` and a `responseSchema` (`src/lib/gemini/fraudCaseSchema.ts`) so output is typed JSON matching `FraudAnalysis`.
- The API key is read **at call time** (not module load) so environment loading order cannot bypass it.
- On a missing key or any error, the orchestrator falls back to a deterministic heuristic (`generateHeuristicMockAnalysis`) and logs the real reason in development.

---

## Request flows

### 1. Quick Check (public)
```
POST /api/quick-check/analyze   (rate-limited, no auth)
  → redactPIIAndSecrets(input)              # raw text never sent to AI or stored
  → analyzeFraudCase("Quick Check…", redactedText, [])   # Gemini or heuristic
  → quickCheckEntities(redactedText)        # conservative, regex-based entity extraction
  → return ephemeral QuickCheckResult       # nothing written to Firestore/Storage/disk
```
Optional follow-ups from the result: **save as a private case** (requires auth) or **share a redacted community signal** (consent-gated).

### 2. Private case (authenticated, owner-isolated)
```
POST   /api/cases                         create case (ownerId = token uid)
GET    /api/cases                         list — where ownerId == uid
GET    /api/cases/:id                     read — re-checks ownerId
POST   /api/cases/:id/evidence            add text evidence (redacted on store)
POST   /api/cases/:id/evidence/upload     upload file → validate → Cloud Storage
GET    /api/cases/:id/evidence/:eid/file  download — ownership-checked stream
POST   /api/cases/:id/analyze             run analyzeFraudCase over the evidence
GET    /api/cases/:id/report              fetch the report payload
PUT/PATCH /api/cases/:id                  update (field-whitelisted; ownerId immutable)
DELETE /api/cases/:id[/evidence/:eid]     delete (ownership-checked; purges storage)
```
Every route above is wrapped in `requireAuth`, and every case-scoped handler verifies `caseData.ownerId === req.user.uid` before acting.

### 3. Community signal + admin review
```
POST  /api/quick-check/submit-signal      public, rate-limited
        → stores ONLY redacted/derived data (no raw input, no files)

GET   /api/admin/community-signals        requireAdmin (ADMIN_EMAILS allowlist)
PATCH /api/admin/community-signals/:id    requireAdmin — review status/notes (redacted)
GET   /api/admin/me                       capability probe (is the caller an admin?)
```
`requireAdmin` is **fail-closed**: with no allowlisted emails, every authenticated user is denied.

### 4. PDF export (client-side)
```
Browser: ReportPreview  →  src/lib/pdf/generateReportPdf.ts
   → html2canvas renders the report view
   → jsPDF assembles the PDF  (DOMPurify sanitizes any HTML)
   → file downloaded in the browser
```
PDF generation happens entirely in the browser; the server is only involved in providing the underlying report data (`GET /api/cases/:id/report`).

---

## Build & run topology

| Mode | Client | Server |
|---|---|---|
| Development (`npm run dev`) | Vite middleware (HMR) mounted in Express | `tsx server.ts` |
| Production (`npm run build` → `npm start`) | Static `dist/` assets served by Express | `dist/server.cjs` (esbuild bundle) |

See [`SECURITY_PRIVACY_OVERVIEW.md`](SECURITY_PRIVACY_OVERVIEW.md) for the trust boundaries and [`../README.md`](../README.md) for setup.
