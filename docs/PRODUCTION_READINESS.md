# Production Readiness Checklist

Pre-launch review for FraudCase GH. Pair with [`ENV_SETUP.md`](./ENV_SETUP.md) and
[`MANUAL_E2E_QA.md`](./MANUAL_E2E_QA.md).

## Security
- [ ] All `/api/*` private routes require a verified Firebase ID token (`requireAuth`) — anonymous → 401.
- [ ] Every case/evidence route re-checks `ownerId === req.user.uid` (403 on mismatch).
- [ ] Admin routes require `requireAdmin` (token + `ADMIN_EMAILS`) — 401/403; **fail-closed**.
- [ ] Upload validation: extension + MIME + **magic-byte** allowlist; 10 MB cap; filename sanitized.
- [ ] Download proxy sets `nosniff`, CSP sandbox, forced attachment for non-images, HTML → `text/plain`.
- [ ] No client-side Gemini key; all AI runs server-side.
- [ ] `unhandledRejection` guard present so a failed background promise can't crash the server.

## Privacy
- [ ] Redaction guard runs before AI **and** before any anonymous storage.
- [ ] Quick Check stores nothing by default; community signals store **redacted-only** (`rawFileStored: false`).
- [ ] PDF export redacts all free text (phones/emails/cards/PINs masked); no raw files embedded.
- [ ] Admin dashboard shows only masked/derived data; admin notes re-redacted on save.
- [ ] No public list of accused people; no public phone/scammer database; non-accusatory language throughout.

## Firebase rules
- [ ] `firestore.rules` deployed: `cases` owner-isolated, `ownerId` immutable, `communitySignals` `if false`.
- [ ] Confirm a direct client read of `communitySignals` is denied.

## Storage rules
- [ ] `storage.rules` created from [`STORAGE_RULES.md`](./STORAGE_RULES.md) and deployed.
- [ ] Bucket is private (no `allUsers`/public access); only the authenticated server proxy reads files.

## Environment
- [ ] `npm run check:env` reviewed; required vars set for the target environment.
- [ ] `GEMINI_API_KEY` and `ADMIN_EMAILS` injected from a secret manager (not `.env`).
- [ ] Admin credentials via the runtime service account (no key file in the image).
- [ ] `.env`, service-account keys, and `secure_uploads/` are git-ignored and not in the image.

## Admin access
- [ ] `ADMIN_EMAILS` set to the real reviewer list; verify a non-admin gets 403 and no admin UI.
- [ ] (Plan) migrate from email allowlist to custom-claim roles (`admin: true`).

## Rate limiting / App Check — TODO
- [ ] Replace in-memory per-IP limiters (Quick Check analyze + signal submit) with a durable store.
- [ ] Add **Firebase App Check** / CAPTCHA to public endpoints (`/api/quick-check/*`).
- [ ] Add rate limiting + audit logging to admin routes.

## Known limitations
- Admin SDK bypasses Firestore/Storage rules → security currently rests on the Express layer; rules
  are defense-in-depth for any future direct-client access.
- In local dev without credentials, uploads use a `secure_uploads/` fallback (`local-dev`); this is
  dev-only and ephemeral on Cloud Run.
- Community-signal stats read the whole collection (fine for MVP; move to aggregation at scale).
- No URL router — admin and Quick Check are guarded view-states, not literal `/admin/...` URLs.
- PDF uses standard Helvetica (only the cedi sign is normalized); section blocks can break across pages.
- Heuristic mock analysis (no `GEMINI_API_KEY`) returns template content not derived from input.

## Before public launch
- [ ] Full [`MANUAL_E2E_QA.md`](./MANUAL_E2E_QA.md) pass (A–G) + all negative cases (H) denied.
- [ ] Rules (Firestore + Storage) deployed and spot-checked.
- [ ] Secrets in a secret manager; no secrets in the repo or image.
- [ ] App Check / rate limiting on public endpoints.
- [ ] Real `ADMIN_EMAILS` configured; admin isolation verified.
- [ ] `npm run lint` + `npm run build` green on the release commit.
- [ ] Backups/retention and incident-contact channels documented.
