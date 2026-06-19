# FraudCase GH — Next Steps (Build Order)

_Phase: **Evidence upload / download / redaction hardening**. Do this before Public Quick Check._

Companion to [`LOCAL_HANDOFF.md`](./LOCAL_HANDOFF.md). Ordered by risk × effort: cheap protective
fixes first, then correctness, then defense-in-depth. Out of scope for this phase: Public Quick
Check, PDF engine, Next.js migration, UI/brand changes.

---

## 0. Prerequisite — make persistence runnable locally
Not a code change, but nothing in this phase can be runtime-verified without it.
- Configure Firebase Admin credentials for project `stellar-perigee-498907-c4`:
  `gcloud auth application-default login` **or** set `GOOGLE_APPLICATION_CREDENTIALS` to a
  service-account JSON. Keep the key out of git.
- (Optional) set `GEMINI_API_KEY` in `.env` to exercise the real analysis path instead of the mock.

---

## 1. Stop raw evidence from leaking to git  ·  _≈1 line, do first_
- Add `secure_uploads/` to `.gitignore`. The upload handler writes user files (PII) to local disk;
  without this a `git add .` can commit evidence into history. No live leak yet — nothing has been
  uploaded locally — but this is the cheapest, highest-value fix.
- _Offered as a ready one-liner; left unapplied to honor the audit-only scope._

## 2. Make the local-disk copy intentional (or remove it)
- In `server.ts` the `secure_uploads/` write runs **unconditionally**; `gcsSuccess` is computed and
  never used. Decide one:
  - **(a)** Write to disk **only** when `gcsSuccess === false` (true fallback), **or**
  - **(b)** Remove the local copy entirely and rely on GCS (Cloud Run disk is ephemeral anyway).
- Whichever path: ensure the download handler's fallback (`serveLocalFile`) and the delete handler's
  local-purge branch stay consistent with the decision.

## 3. Redact uploaded file *bytes*, not just `originalText`
- For text-like uploads (`.txt/.csv/.json/.html`), run the buffer through `redactPIIAndSecrets`
  before persisting, and store the redacted form (or store redacted + keep raw access gated).
- Define and document the policy for **binary** evidence (images/PDF): redaction can't touch pixels,
  so record that these are stored raw and rely on access control. Capture this in `SECURITY.md`.
- Goal: no unredacted PII at rest in GCS **or** local disk for the formats we can sanitize.

## 4. Validate file content, not just the declared MIME/extension
- Add magic-byte sniffing (e.g. `file-type`) and reject when sniffed type ∉ allowlist or disagrees
  with the declared extension. Keeps the existing extension+MIME allowlist as a first gate.
- Keep all current download-side protections (attachment disposition, `CSP: default-src 'none';
  sandbox`, `nosniff`, html→`text/plain`).

## 5. Clean upload error handling
- Add a `multer` error handler so a >10 MB file or rejected type returns a clean `400` with a clear
  message instead of falling through to a generic `500`.
- Consider per-upload idempotency: `evidenceId = ev-${Date.now()}` can collide within the same ms;
  add a short random suffix.

## 6. Harden the download path (defense-in-depth)
- In `serveLocalFile`, build the local path from the **stored** evidence record (sanitized
  `storagePath`/`fileName`) rather than the raw `:evidenceId` URL param. It's currently safe
  (ownership + stored-id match gate it), but param-derived paths are worth removing on principle.

## 7. Add `storage.rules` and document the trust boundary
- There is **no `storage.rules`** in the repo. Add owner-isolated rules matching the
  `users/{uid}/cases/{caseId}/evidence/...` path even though current access is Admin-SDK-only
  (which bypasses rules). This is required before any direct-client Storage access.
- Note in `SECURITY.md` that today's security rests **entirely** on the Express `requireAuth` +
  `ownerId` checks, and that `firestore.rules` is dormant for the current server-mediated path.

## 8. Protect the analyze endpoint
- Add Firebase App Check (and/or simple per-user rate limiting) to `/api/cases/:id/analyze` before
  enabling real Gemini in production, to cap automated-abuse cost.

---

### Exit criteria for this phase
- [ ] `secure_uploads/` git-ignored; local-disk behavior is intentional and documented.
- [ ] No unredacted PII at rest for text-format evidence; binary policy written down.
- [ ] Upload validation includes content sniffing; oversized/invalid uploads return `400`.
- [ ] `storage.rules` present; trust boundary documented in `SECURITY.md`.
- [ ] `npm run lint` and `npm run build` still green; upload→download→delete verified end-to-end
      once Admin credentials are configured.

### After this phase
Public Quick Check (unauthenticated triage) — only once the redaction/at-rest story above is solid,
since that feature widens the input surface. Then the high-fidelity PDF engine in `ReportPreview`.
