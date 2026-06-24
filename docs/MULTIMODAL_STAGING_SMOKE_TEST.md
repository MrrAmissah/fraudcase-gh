# Multimodal Extraction: Staging Smoke-Test Runbook

**Status:** Plan only. NOT executed. Uncommitted pending approval. This is the operational gate before `MULTIMODAL_EXTRACTION_ENABLED` is ever set `true` outside local/dev.
**Date:** 2026-06-24
**Applies to:** `main` at `6bfc366` (Sprint 3 backend + Sprint 4 workspace merged).
**Related:** [`DEPLOYMENT_RUNBOOK.md`](./DEPLOYMENT_RUNBOOK.md), [`PRODUCTION_ENV_CHECKLIST.md`](./PRODUCTION_ENV_CHECKLIST.md), [`GEMINI_QUOTA_AND_BILLING.md`](./GEMINI_QUOTA_AND_BILLING.md), [`SPRINT_3_PLAN.md`](./SPRINT_3_PLAN.md), [`STORAGE_RULES.md`](./STORAGE_RULES.md).

**Hard rules for whoever runs this:** staging only. Do not enable the flag in production. Do not touch production data. Use tiny test files. One or two extraction calls maximum. Stop on any quota/billing error and do not retry.

This runbook verifies the private multimodal extraction feature end to end against live auth, Gemini, Firestore, and GCS, with the privacy/security invariants intact. It is the one thing that has not been exercised: local QA covered the pipeline logic with a mock model; the route glue past `requireAuth` and the real Gemini/Firestore/GCS path are unverified until this runs.

Each step is labeled **[UI]** (do in the browser) or **[curl]** (direct API call). Several negative tests are **[curl]** only because the Sprint 4 UI cannot produce them.

---

## 0. Blocking preconditions (resolve ALL before the test can start)

If any of these is wrong, the test dead-ends at sign-in or at the first Firestore write. Verify them first.

1. **Staging build uses staging Firebase values.** `VITE_FIREBASE_*` are inlined at build time. You must build the artifact in/for staging with the staging `VITE_FIREBASE_*` values. A dev-built bundle cannot be promoted to staging.
2. **Web API key referrer allowlist includes the staging hostname.** The staging `VITE_FIREBASE_API_KEY` is HTTP-referrer-restricted. The staging origin (for example `https://staging.example`) must be on the key's allowed-referrers list, or browser auth/Gemini-less Firebase calls are blocked.
3. **Firebase Auth Authorized domains include the staging hostname.** Add the staging host under Firebase Auth settings, or sign-in popups/redirects and token issuance fail.
4. **Firestore database id matches the hardcoded id.** `src/lib/firebase/admin.ts` binds a NAMED Firestore database `ai-studio-36d6feb3-b3c2-4e2a-9c6b-46c7b67a02e9` (only the project id and storage bucket come from env). Either:
   - run staging in a Firebase project that has a Firestore database with that exact id, OR
   - use the existing project with **clearly isolated staging data** (a dedicated throwaway test user and case, deleted afterward). This is the simpler path and is assumed below.
5. **Admin credentials are runtime ADC in staging only.** Firebase Admin uses Application Default Credentials (org policy blocks service-account JSON key creation). The staging runtime service account must have Firestore + Storage object access. No key file is committed.
6. **`MULTIMODAL_EXTRACTION_ENABLED` is still OFF** in the staging environment before the test begins (default off; confirm it is not set, or set to anything other than `true`).
7. **Pre-test auth check:** load the staging app and confirm sign-in succeeds for the test user BEFORE doing anything else. If sign-in fails, stop and fix items 1 to 3 (referrer / authorized domains / build).

---

## 1. Preconditions checklist

| # | Item | How to confirm |
|---|---|---|
| 1 | Staging environment reachable | `curl -s -o /dev/null -w '%{http_code}\n' https://STAGING/api/health` returns `200` |
| 2 | Staging Firebase project or clearly isolated staging data | §0.4 resolved; dedicated test user + case |
| 3 | Staging `VITE_FIREBASE_API_KEY` set, referrer-allowed for staging host | §0.1, §0.2; sign-in works (§0.7) |
| 4 | Staging `GEMINI_API_KEY` present (server-only secret) | Set in staging secret store; never client-exposed; not printed |
| 5 | Firebase Admin ADC available in staging only | Runtime SA has Firestore + Storage roles |
| 6 | **Two** test user accounts (A and B) | Needed for the wrong-owner negative test (§3) |
| 7 | Private test case (owned by user A) | Created in §2 |
| 8 | Safe test PNG/JPEG (tiny, synthetic, no real PII) | For example a small fake MoMo-receipt mock image |
| 9 | Safe test PDF (tiny, born-digital, synthetic) | One short page |
| 10 | Logs accessible for review | Platform log aggregator / `gcloud logging` reachable |
| 11 | `MULTIMODAL_EXTRACTION_ENABLED` OFF before start | §0.6 |
| 12 | GCP budget alerts + Gemini quota configured | Per `GEMINI_QUOTA_AND_BILLING.md` |

Test files must be tiny and synthetic. No real phone numbers, no real chat transcripts, no real receipts.

**Obtaining test tokens for [curl] steps (no secrets printed):** sign in as each user in the browser, open DevTools to the Network tab, and copy the `Authorization: Bearer ...` header from any `/api/cases` request into a shell variable. Do not echo or commit it.

```bash
export STAGING="https://STAGING_HOST"
export TOKEN_A="<paste user A bearer token>"   # do not echo
export TOKEN_B="<paste user B bearer token>"   # second identity, do not echo
```

---

## 2. Test sequence (ordered; flag stays off until step 8)

1. **[curl] Health.** `curl -s $STAGING/api/health` returns `{"status":"ok",...}` (HTTP 200).
2. **[UI] Sign in** as test user A on staging (already confirmed in §0.7).
3. **[UI] Create a private case** (New Case). Note the `caseId` from the URL/case header.
4. **[UI] Upload image evidence** (the tiny PNG/JPEG) to the case. Confirm it appears in the Evidence Vault.
5. **[UI] Upload PDF evidence** (the tiny PDF) to the case.
6. **[UI] Note the evidence ids** for the image and PDF items (shown on each evidence card; or read from the case via `GET /api/cases/$CASE_ID`).
7. **[curl] DISABLED-FLAG CHECK (do this BEFORE enabling the flag).** The flag is read from env, so changing it later requires a redeploy/restart. With the flag still off:
   ```bash
   curl -s -o /tmp/r.json -w '%{http_code}\n' -X POST \
     -H "Authorization: Bearer $TOKEN_A" -H 'Content-Type: application/json' \
     -d '{"consentGiven":true}' \
     "$STAGING/api/cases/$CASE_ID/evidence/$IMG_EVIDENCE_ID/extract"
   ```
   Expect **503** and `{"error":"Multimodal extraction is not enabled."}`. Capture the body.
8. **[env] Enable the flag in staging only**, then redeploy/restart so the server re-reads env: set `MULTIMODAL_EXTRACTION_ENABLED=true`. Confirm `/api/health` returns 200 after restart. (Operator action; not a code change. Do not enable anywhere but staging.)
9. **[UI] Run extraction with explicit consent** on the image evidence: click "Extract text (AI)", confirm the Gemini consent dialog, "Process with Gemini". This is one extraction call. (Optionally repeat once on the PDF: that is the second and final allowed call.)
10. **[UI] Review the extracted artifact**: open "Review & verify extraction". Confirm the split-screen shows the evidence preview and the extracted-facts panel with status badges reading "Suggested by AI" (not trusted).
11. **[UI] Accept one fact** and **Reject one fact**. Confirm the accepted one flips to "Accepted by you" and the rejected one to "Rejected"; the count summary updates.
12. **[UI] Re-analyze** the case (the stale-analysis nudge "Re-analyze to include your accepted facts" should appear after step 11; use it). Confirm the analyze call succeeds (HTTP 200, analysis renders).
13. **[observe] Confirm accepted-facts inclusion** via the observable signals in §7 (the analyze succeeds and the expected accepted count was fed in). Do NOT try to read "excluded" out of the model's prose (see §7 honesty note).
14. **[env] If pausing or finished, disable the flag again** (`MULTIMODAL_EXTRACTION_ENABLED=false`) and restart. See §6.

---

## 3. Privacy / security checks

Run these alongside §2. Mark each pass/fail.

| Check | Method | Expected |
|---|---|---|
| Raw OCR not persisted | §4 Firestore read of the evidence item + run doc | No `rawVisibleText` field anywhere; only `redactedText` on the artifact |
| Raw Gemini prompt/response not logged | Grep staging logs for the extraction window | Only structured events; no prompt/response text |
| Raw evidence bytes not logged | Grep logs | No base64/binary; events carry counts only |
| Signed URLs not logged | Grep logs | None present (the server reads bytes via `storagePath`, never a signed URL) |
| Phone-like values masked | §4 read of artifact facts | Phone fact `redactedValue` like `0XXX***XXX`; no full number; sensitive facts have no `normalizedValue` |
| Facts stay suggested until accepted | [UI] §2.10 | Badges read "Suggested by AI"; `verifiedByUser=false` until you Accept |
| Final analysis uses accepted facts only | §7 observable | Accepted count fed in; deterministic exclusion already proven by unit/harness tests |
| Wrong-owner denied | **[curl]** user B's token vs user A's case (below) | 403 |
| Missing consent rejected | **[curl]** valid token, no consent (below) | 400 |
| Disabled flag returns calmly | §2.7 (run before enabling) | 503, calm message |

**Wrong-owner [curl]** (the UI never exposes another owner's case, so this is API-level):
```bash
curl -s -o /tmp/owner.json -w '%{http_code}\n' -X POST \
  -H "Authorization: Bearer $TOKEN_B" -H 'Content-Type: application/json' \
  -d '{"consentGiven":true}' \
  "$STAGING/api/cases/$CASE_ID/evidence/$IMG_EVIDENCE_ID/extract"
# Expect 403 "Forbidden: Access denied to this case resource."
```

**Missing-consent [curl]** (the UI always sends `consentGiven:true`, so this cannot be triggered in-app):
```bash
curl -s -o /tmp/consent.json -w '%{http_code}\n' -X POST \
  -H "Authorization: Bearer $TOKEN_A" -H 'Content-Type: application/json' \
  -d '{}' \
  "$STAGING/api/cases/$CASE_ID/evidence/$IMG_EVIDENCE_ID/extract"
# Expect 400 "Consent is required to run AI extraction on this evidence."
```

**Log grep guidance.** Expected extraction events are structured and content-free: `evidence_extracted` (status, factCount), `multimodal_extract_ok` (provider, factCount, signalCount), `multimodal_extract_skipped`, `multimodal_extract_timeout`, `multimodal_extract_error` (errorType only). Confirm NONE of the log lines for the test window contain: the test phone number, the visible text, the word-for-word evidence, a base64 blob, or any `http...storage...?...signature/token` URL.

---

## 4. Firestore / GCS checks

**Critical:** query the NAMED database `ai-studio-36d6feb3-b3c2-4e2a-9c6b-46c7b67a02e9`, not `(default)`. A query against the default DB returns empty and reads as a false "clean".

- **GCS object exists under the owner-isolated path:** confirm an object at `users/{uidA}/cases/{CASE_ID}/evidence/{IMG_EVIDENCE_ID}/{safeName}` in the staging bucket. Confirm the bucket is not public (a direct public URL is denied).
- **Evidence document inspection (named DB):** read `cases/{CASE_ID}` and inspect the matching `evidenceItems[]` entry. Easiest is the Firebase console with the correct database selected, or a tiny scoped admin read. With the gcloud CLI:
  ```bash
  gcloud firestore documents get \
    "projects/STAGING_PROJECT/databases/ai-studio-36d6feb3-b3c2-4e2a-9c6b-46c7b67a02e9/documents/cases/$CASE_ID"
  ```
  Confirm on the extracted evidence item: `extractedArtifact.redactedText` present (redacted), `extractedArtifact.facts[]` carry `redactedValue` (sensitive ones masked) and `verificationStatus`, `privacyFlags.rawTextPersisted == false`, and there is **no** `rawVisibleText` and **no** raw `rawValue` field anywhere.
- **Run subcollection (named DB):** list `cases/{CASE_ID}/extractionRuns` and read the run doc. Confirm it carries status/counts/provider/model and a `consentGiven: true` + `consentRecordedAt` timestamp only. Confirm there is NO text field (no `redactedText`, no `rawVisibleText`, no prompt/response).
- **No raw phone in the persisted document:** the test phone number string must not appear anywhere in the `cases/{CASE_ID}` document or its run docs.

**Cleanup caveat:** deleting the case document does NOT cascade-delete the `extractionRuns` subcollection (Firestore never auto-deletes subcollections). Those run docs orphan. That is harmless because they carry no sensitive data (which is itself a confirmation), but delete the subcollection explicitly if you want zero residue (see §6).

---

## 5. Cost / quota controls

- Use tiny synthetic test files only (a few KB).
- **One or two extraction calls maximum** for the whole run (one image, optionally one PDF). Do not loop.
- **Stop trigger (observable):** a quota/billing failure surfaces as a `multimodal_extract_error` event (errorType only) with the run doc `status: "failed"`, and the UI shows "Extraction could not be completed." On seeing this, STOP. Do not retry. Check GCP billing/quota and report.
- Watch GCP billing budget alerts (50/80/100%). Any alert during the test means stop and report.

---

## 6. Rollback / teardown

1. **Disable the flag:** set `MULTIMODAL_EXTRACTION_ENABLED=false` (or unset) in staging and redeploy/restart. Confirm `/api/health` 200 and that a fresh extract call now returns 503.
2. **Remove staging test data if safe:** delete the test case (`DELETE /api/cases/$CASE_ID` as user A, or via console). This also purges the GCS evidence object and the embedded artifact. Then explicitly delete the orphaned `cases/{CASE_ID}/extractionRuns/*` docs (they do not cascade).
3. **Logs:** keep logs only if they contain no sensitive evidence (they should not, since events are content-free). If any log line contains evidence content, that is a finding (stop and report); do not retain it.
4. **Never touch production.** No production env, data, flag, or deploy is in scope here.

If a flag enablement caused any incident, disabling the flag + restart is the first rollback action (no schema reversal needed; no data migration was introduced).

---

## 7. Evidence to capture + success / failure criteria

Capture for the report:
- `/api/health` status code.
- The §2.7 disabled-flag response (503 + body).
- The §3 wrong-owner (403) and missing-consent (400) responses.
- The 201 extract response shape `{ evidenceId, extractionRunId, artifact }` (artifact redacted; screenshot the workspace).
- The Firestore evidence item + run doc dumps (§4) with the privacy fields highlighted.
- The relevant structured log lines for the window (showing counts only, no content).
- The re-analyze HTTP 200 and the rendered analysis.

**Pass** when ALL hold: health 200; disabled-flag 503 before enable; happy-path extraction returns a redacted artifact with masked sensitive values; facts are suggestions until accepted; Accept/Reject persist; re-analyze succeeds; wrong-owner 403; missing-consent 400; Firestore shows redacted-only artifact + content-free run doc in the named DB; no raw OCR/phone/prompt/response/signed-URL/bytes in storage docs or logs.

**Honesty note on "rejected/unaccepted excluded":** pass B output is Gemini prose; you cannot reliably read "this fact was excluded" out of free text. Do not write that as a staging success criterion. The deterministic proof that only accepted facts feed analysis already exists at the bundle-builder level in the unit/harness tests. In staging, scope the claim to the observable: after accept-one/reject-one + re-analyze, the analyze call succeeds and the expected accepted-fact count is what was fed in.

**Fail** on any: persisted `rawVisibleText`/raw phone/raw `rawValue`; any prompt/response/bytes/signed-URL in logs; a fact trusted without user acceptance; analysis consuming an unaccepted fact; wrong-owner or missing-consent not denied; or a 5xx on the happy path.

---

## When to STOP and ask

Stop immediately and report (do not retry, do not work around) if:
- Any **quota or billing error** (`multimodal_extract_error` + run `failed`, or a 429), or any budget alert.
- Any **privacy leak**: raw OCR/phone/`rawValue` persisted, or any evidence content / prompt / response / signed URL / token in logs.
- **Owner isolation or consent** does not behave (wrong-owner not 403, missing-consent not 400).
- Sign-in cannot be established (referrer/authorized-domains/build precondition unmet).
- Anything requires a **code change, a production touch, a secret/env change beyond the single staging flag, or more than two extraction calls**.

Do not enable `MULTIMODAL_EXTRACTION_ENABLED` in production based on this run. Production enablement is a separate decision after a clean staging pass.

_Last updated: 2026-06-24_
