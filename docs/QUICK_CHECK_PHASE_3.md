# Quick Check Phase 3 — Anonymous Community Signals

Lets a public user **optionally** share a redacted Quick Check result as an anonymous community
fraud signal for later pattern review. Consent-gated. No raw data, no files, no public exposure.

## Consent behavior
- The "Share a redacted signal…" control on the Quick Check result is **off by default**.
- Clicking it opens a consent panel with exactly:
  > "FraudCase GH can keep a redacted copy of this result to help identify recurring scam patterns.
  > We do not publish your submission, and this does not become an official report."
- Options: **Share redacted signal** / **Cancel**. Submission only happens on explicit confirm,
  which sends `consentGiven: true`.
- On success: a calm confirmation replaces the control —
  > "Thanks. A redacted signal has been submitted for pattern review."
- On failure: a calm, recoverable error; the consent panel stays open for retry.

## Endpoint summary
`POST /api/quick-check/submit-signal`
- **No authentication** (public, anonymous).
- **Rate limited**: best-effort per-IP daily cap (`SIGNAL_DAILY_LIMIT = 10`), separate from the
  analyze limiter. Over the cap → `429` with a clear message. (x-forwarded-for is spoofable — this
  is a scaffold; App Check/CAPTCHA is the real control, tracked in `QUICK_CHECK_TODO.md`.)
- **JSON only** — no `multer`, so uploaded files are never accepted or processed.
- Body: `{ consentGiven: true, result: QuickCheckResult }`.
- Validation / privacy guard, in order:
  1. `consentGiven !== true` → `400`.
  2. Missing `result` or empty `result.redactedText` → `400`.
  3. **Idempotency guard**: re-run the redaction guard on `redactedText`; if it changes, raw
     sensitive data is present → `400`, nothing stored.
- On success → `201 { success: true }` (the signal id is not returned to the anonymous client).

## What IS stored (`communitySignals/{signalId}`)
All fields are redacted or server-derived:
| Field | Value |
|-------|-------|
| `source` | `"quick_check"` |
| `consentGiven` | `true` |
| `redactedText` | masked text (verified idempotent under the redaction guard) |
| `scamCategory`, `riskScore`, `confidence` | from the result (type-checked) |
| `possibleFraudIndicators` | capped **and re-redacted** server-side |
| `extractedEntities` | re-derived: phone tokens kept only if masked; **names/refs dropped** |
| `normalizedDomain` | hostname of the first URL (or `null`) |
| `normalizedSender` | `null` (not reliably derivable yet — Phase 4) |
| `maskedPhone` | first **masked** phone token (or `null`) |
| `amountRequested` | first amount (or `null`) |
| `countryContext` | `"GH"` |
| `createdAt` | ISO timestamp |
| `reviewedStatus` | `"pending"` |
| `clusterId`, `userId` | `null` |
| `rawFileStored` | `false` |

## What is NEVER stored
- Raw/unredacted text (rejected by the idempotency guard).
- Raw phone numbers, full emails, card numbers, bank accounts, PINs/passwords, secrets — masked by
  the redaction guard before they could ever reach this endpoint, and re-verified here.
- Uploaded files, screenshots, or documents (endpoint accepts JSON only; `rawFileStored: false`).
- Names or transaction references (explicitly dropped from `extractedEntities`).
- Any `userId` (always `null` — anonymous).

## Access / isolation
- `communitySignals` is written via the **Admin SDK** (server only). `firestore.rules` adds an
  explicit `allow read, write: if false` for the collection, so no client can ever read or write it
  directly. Admin review access is mediated server-side and arrives in Phase 4.

## Remaining Phase 4 (admin dashboard) tasks
- `ADMIN_EMAILS` allowlist + `requireAdmin` middleware (verify ID token + email ∈ allowlist).
- Admin-only routes: list signals, mark `reviewed` / `false_positive` / `useful pattern`.
- `AdminSignalsPage`, `AdminSignalTable`, `AdminSignalDetailDrawer`, `SignalClusterCard`.
- Clustering: populate `clusterId`, derive `normalizedSender`, repeated-domain/sender views.
- Keep the admin surface invisible to normal users (server-guarded, not just hidden UI).
