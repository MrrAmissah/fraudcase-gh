# Evidence Upload / Download / Redaction — Security QA Checklist

Manual test cases for the upload/download/redaction hardening phase
(`fix/evidence-upload-hardening`). Run after any change to `server.ts` or
`src/lib/security/fileValidation.ts`.

## Prerequisites
- **Pure-function checks** (validation logic) run with **no credentials** — see the bottom section.
- **End-to-end checks** require Firebase **Admin credentials** (ADC or a service-account key) so
  Firestore + Cloud Storage work. Without them, uploads fall back to `storageProvider: "local-dev"`
  (files land in the git-ignored `secure_uploads/`) — useful for exercising the flow locally, but
  the GCS path itself is then unverified.
- Sign in as **User A**; have a second account **User B** for the cross-tenant test.

---

## A. Allowed uploads (expect success, HTTP 201)
| # | Test | Expected |
|---|------|----------|
| A1 | Upload a real **PNG/JPG/WebP** image | Stored; `storageProvider` set; card shows image, **View** opens it inline in a new tab |
| A2 | Upload a real **PDF** | Stored; card shows **Get**; download arrives as an **attachment** (never inline-rendered) |
| A3 | Upload a **TXT** containing `Call 0244123456, email me@x.com` | Stored; `extractedText`/`redactedText` show `[PHONE…]`/`[EMAIL-REDACTED]`; green **"Redacted & Safe"** badge; **no raw `originalText` persisted** |
| A4 | Upload a **CSV/JSON** with phone/card-like values | Readable text extracted server-side, redacted, capped at 20k chars |

## B. Rejected uploads (expect HTTP 400, nothing persisted)
| # | Test | Expected |
|---|------|----------|
| B1 | Upload a file **> 10 MB** | `400` "File exceeds the 10MB maximum upload size." (clean, not a 500) |
| B2 | Upload a **`.js` / `.sh` / `.exe`** file | `400` "Forbidden file type…" (extension not allowlisted) |
| B3 | **Fake MIME / disguised**: rename `script.js` → `photo.png` and upload | `400` "File contents do not match the declared file type…" (content sniffed as text, expected png) |
| B4 | Rename an **`.exe` → `report.pdf`** | `400` mismatch (sniffed `unknown`, expected pdf) |
| B5 | Upload a file with a disallowed declared **MIME** | `400` "Declared content-type is not permitted…" |

## C. HTML safety
| # | Test | Expected |
|---|------|----------|
| C1 | Upload an **`.html`** file with `<script>` and PII | Accepted as evidence; contents treated as **plain text** — redacted text preview shows the source escaped (React text node), **never executed** |
| C2 | Download/preview the HTML evidence | Served with `Content-Type: text/plain`, `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox` — browser does **not** render it as a page |

## D. Download / ownership
| # | Test | Expected |
|---|------|----------|
| D1 | User A downloads own evidence | `200`, correct bytes, correct disposition |
| D2 | **User B** requests User A's file URL (`/api/cases/{A_case}/evidence/{id}/file`) | `403` Forbidden — ownership check blocks it |
| D3 | Unauthenticated request to any `/api/...` | `401` Unauthorized (verified in this env) |
| D4 | Request a non-existent evidence/case id | `404` |

## E. Redaction → AI
| # | Test | Expected |
|---|------|----------|
| E1 | Add evidence text with phone/email/card/Ghana-Card/OTP | `redactionWarnings` populated; `detectedSensitiveTypes` lists the categories |
| E2 | Run **Analyze** on a case with readable-file evidence | Gemini receives `redactedText` (analysis uses `redactedText || originalText`); **raw file contents are never sent** |
| E3 | Confirm `redactedText` and `extractedText` for a readable file are the **same string** | They are (single sanitized value), so the card preview and AI input cannot diverge |

## F. Storage honesty & cleanup
| # | Test | Expected |
|---|------|----------|
| F1 | Upload with Cloud Storage **available** | `storageProvider: "gcs"`, `storagePath` set, **no** local copy written to `secure_uploads/` |
| F2 | Upload with Cloud Storage **unavailable** in **production** (`NODE_ENV=production`) | `502` "Evidence storage is temporarily unavailable…"; **nothing persisted** (no silent local-only save) |
| F3 | Upload with Cloud Storage **unavailable** in **development** | `storageProvider: "local-dev"`; file in git-ignored `secure_uploads/`; server logs `[DEV-ONLY]` warning |
| F4 | **Delete** an evidence item | Removed from the case doc; GCS object purged (gcs items) and local copy/dir purged (local-dev items) |

---

## Pure-function checks (no credentials needed)
The validation helpers in `src/lib/security/fileValidation.ts` are unit-testable in isolation.
A throwaway script verified all of the following (17/17 passing) during this phase — re-run a
similar script after edits:
- PNG/JPEG/WebP/PDF header detection → correct kind
- UTF-8 text with accents (`é`, `₵`) → classified `text`, **not** false-rejected
- JS source → `text`; MZ/NUL-containing buffer → `unknown`
- `validateUploadedFile` accepts real png/pdf/csv/html; rejects js-as-png, exe-as-pdf, `.js`,
  bad MIME, and png-bytes-claiming-`.html`

---

## Known limitations (documented, intentionally not changed this phase)
- **Strict PDF signature.** `%PDF-` must be at byte offset 0. Rare PDFs with leading junk bytes
  (which Acrobat tolerates) will be rejected. Acceptable security-strict trade-off for the MVP — so
  a surprising PDF rejection is expected behavior, not a bug.
- **Cumulative Firestore document size.** Each item's extracted text is capped at 20k chars, but
  `evidenceItems` is an array inside the case document; many large items could approach Firestore's
  1 MiB per-document limit. Pre-existing; a future phase may move evidence to a subcollection.
- **Text-paste endpoint residual.** `POST /api/cases/:id/evidence` (typed/pasted text, not files)
  still stores the user's raw `originalText` at rest (it does compute `redactedText`, and AI uses
  the redacted form). This phase scoped redaction hardening to **uploaded file bytes**; the
  paste-path at-rest redaction is a known follow-up.
- **No malware/virus scanning** of stored files (out of scope for MVP).
- **No App Check / rate limiting** on `/analyze` yet (tracked in `NEXT_STEPS.md`).
