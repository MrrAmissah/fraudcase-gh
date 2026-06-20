# FraudCase GH — Security & Privacy Overview

This document describes the security and privacy model of FraudCase GH, with references to the code that enforces each property. It reflects the current implementation (Cloud Storage and redaction are implemented, not future work).

> Scope note: FraudCase GH is a portfolio project. Authorization is enforced **server-side** (token verification + `ownerId` checks). Firestore/Storage security rules as an additional defense-in-depth layer are on the roadmap; see [Known limitations](#known-limitations--honest-caveats).

---

## Threat model in one paragraph

The data handled here is sensitive: scam transcripts often contain phone numbers, Mobile Money details, links, and personal identifiers, and victims are vulnerable. The system is designed so that (a) a user can only ever see their own cases, (b) sensitive data is masked before it reaches an AI model, (c) the low-friction public flow stores nothing, and (d) the tool cannot be used to publicly accuse or expose anyone.

---

## 1. User-owned private cases

Cases belong to exactly one user and are never shared implicitly.

- On creation, `ownerId` is set from the authenticated identity: `ownerId: req.user.uid` (`POST /api/cases`).
- Listing returns only the caller's cases: `adminDb.collection("cases").where("ownerId", "==", req.user.uid)` (`GET /api/cases`).
- There is no cross-user or "all cases" view anywhere in the API.

## 2. Token verification

Every protected endpoint requires a valid Firebase ID token.

- The client sends `Authorization: Bearer <ID token>` on `/api/*` requests.
- `requireAuth` rejects missing/malformed headers with `401`, then verifies the token with `adminAuth.verifyIdToken(token)` and attaches `{ uid, email }` to the request. Invalid/expired tokens return `401`.
- The identity used for authorization comes **only** from the decoded token — never from request bodies or query params.

## 3. `ownerId` isolation

Ownership is re-checked on every case-scoped operation, not just at list time.

- Read, report, evidence add/upload/download, analyze, update, and delete handlers all perform `if (caseData?.ownerId !== req.user.uid) → 403` before doing anything.
- The update handler (`PUT`/`PATCH /api/cases/:id`) whitelists editable fields (`status`, `title`, `description`, `incidentDate`) and `updatedAt`. **`ownerId` is never read from the request body**, so ownership cannot be reassigned by a client.
- Uploaded files are namespaced per user: `users/{uid}/cases/{caseId}/evidence/{evidenceId}/{safeFileName}`, and the file-download endpoint re-verifies ownership before streaming bytes.

## 4. Redaction before AI

Sensitive data is masked before any text is sent to a model (`src/lib/security/redaction.ts`, `redactPIIAndSecrets`).

Detected and masked categories include:
- **Ghana Card** numbers (`GHA-XXXXXXXXX-X`)
- **Email** addresses
- **Phone** numbers (Ghana `+233` / `0[235]...` formats)
- **Credit/debit card** number patterns
- **Bank account** number patterns
- **Secrets** — API keys, tokens, `client_secret`, passwords
- **PIN / OTP / verification codes**

The function returns the redacted text plus `redactionWarnings` and `detectedSensitiveTypes`, which the UI surfaces to the user ("sensitive data was masked before analysis"). For the public Quick Check, redaction runs **before** the call to `analyzeFraudCase`, and the raw input is never sent to the AI.

## 5. No raw anonymous Quick Check storage

The public Quick Check is ephemeral.

- `POST /api/quick-check/analyze` redacts, analyzes, builds a result object, and returns it — **nothing is written to Firestore, Cloud Storage, or disk** (the handler explicitly constructs an in-memory `QuickCheckResult`).
- The flow is rate-limited to discourage abuse.
- A result only becomes durable if the user explicitly chooses to **save it as a private case** (which requires authentication).

## 6. Community signals are redacted

Contributing to pattern analysis is opt-in and minimal.

- `POST /api/quick-check/submit-signal` is consent-gated in the UI and rate-limited.
- It stores **only redacted/derived data** — no raw input text and no files. Even the admin-facing review note is treated as redacted; raw identifiers are not retained.

## 7. Admin-only review (fail-closed)

Only allowlisted admins can review community signals.

- `requireAdmin` verifies the ID token **and** requires the email to be present in the `ADMIN_EMAILS` allowlist (case-insensitive). Authenticated-but-not-admin users receive `403`.
- It is **fail-closed**: if `ADMIN_EMAILS` is empty or unset, `getAdminEmails()` is empty and *no one* is an admin — the admin dashboard is inaccessible to everyone.
- `GET /api/admin/me` is a capability probe so the client can hide the admin link from non-admins without leaking data.

## 8. No public scammer directory

There is intentionally no public exposure of people, cases, or signals.

- No unauthenticated endpoint lists cases, signals, or identities.
- Community signals are visible only to admins, for pattern review — not published.
- The product supports no "wall of shame", search index, or open dox list.

## 9. No legal guilt declarations

The system is designed to avoid defamation and harm.

- The Gemini system instruction and prompt forbid declaring guilt or framing anyone as a confirmed criminal; outputs use cautious language ("possible indicators", "risk signals").
- The response schema requires a **disclaimer**, and the report/UI restate that the analysis is decision-support — not legal advice and not a law-enforcement determination.
- Entity extraction is **grounded in the evidence** (empty when absent) so the tool does not invent identifying details about anyone; the heuristic fallback follows the same non-fabrication rule.

---

## Credentials & secrets handling

- **Server credentials via ADC.** The Admin SDK uses Application Default Credentials (no committed service-account key; key creation is blocked by org policy in the target project). `GOOGLE_APPLICATION_CREDENTIALS` remains supported as an alternative.
- **Public vs. secret config.** The `VITE_FIREBASE_*` web keys are public by design (they ship in the browser and are protected by Firebase, not by secrecy). Server secrets (`GEMINI_API_KEY`, service-account JSON) must never be committed.
- **Git hygiene.** `.env*` and uploaded files are git-ignored; `.env.example` documents the variables without values. The `npm run check:env` script reports presence/absence of variables and credentials **without printing any values**.

## Upload safety

- Uploads are received in-memory via `multer` and passed through `validateUploadedFile` before being stored.
- Stored files are namespaced per user and served only through the ownership-checked download endpoint.

---

## Known limitations & honest caveats

- **Server-side enforcement is the primary control.** Firestore/Storage **security rules** as defense-in-depth are not yet in the repo (roadmap). A misconfigured client SDK alone should not be relied on for authorization — the server checks are what enforce isolation.
- **Dev-only local storage fallback.** When Cloud Storage credentials are absent, evidence is written to a local directory marked `provider=local-dev`. This is for development only and is clearly logged.
- **Redaction is pattern-based.** `redactPIIAndSecrets` uses regex heuristics; it covers common Ghanaian PII/secret formats but is not a guarantee against every possible sensitive string. Users are also prompted to avoid pasting raw credentials.
- **Heuristic fallback is conservative, not clever.** When Gemini is unavailable, categorization is keyword-based — intentionally non-fabricating, but coarser than the model.

---

_FraudCase GH is an educational/portfolio project. It does not provide legal advice and is not affiliated with any government agency or law-enforcement authority._
