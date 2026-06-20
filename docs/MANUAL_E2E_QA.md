# Manual End-to-End QA Checklist

Full manual test pass for FraudCase GH with **real** Firebase + (optionally) Gemini configured.
Use two accounts — **User A** and **User B** — plus one **admin** account (email in `ADMIN_EMAILS`).

## Preconditions
- `npm run check:env` shows Firebase client config set.
- Firebase Admin credentials available (ADC or `GOOGLE_APPLICATION_CREDENTIALS`).
- `GEMINI_API_KEY` set for real analysis (otherwise analysis = heuristic mock — still valid to test).
- `ADMIN_EMAILS` includes the admin account.
- `firestore.rules` deployed; `storage.rules` deployed (from `STORAGE_RULES.md`).
- `npm run dev` (or the built server) running.

---

## A. Auth
| # | Step | Expected |
|---|------|----------|
| A1 | Sign up (User A, email/password) | Account created; lands in dashboard |
| A2 | Sign out, then sign in (User A) | Session restored; cases load |
| A3 | Reload while signed in | Stays signed in (token persists) |

## B. Private case + evidence
| # | Step | Expected |
|---|------|----------|
| B1 | Create a private case (title, description) | Case appears; opens case detail |
| B2 | Add **text** evidence containing a phone/email/PIN | Saved; redaction preview masks them; "Redacted & Safe" badge |
| B3 | Upload **image** (PNG/JPG) | Accepted; appears in vault with size |
| B4 | Upload **PDF** | Accepted; download forces attachment |
| B5 | Upload **TXT/CSV** with a phone number | Accepted; stored `redactedText` is masked (no raw text persisted) |
| B6 | Upload a **`.js`/`.exe`** (or rename one to `.png`) | Rejected (400): forbidden type / content mismatch |
| B7 | Upload a file **> 10 MB** | Rejected (400): size limit (clean error, not 500) |

## C. Analysis + report
| # | Step | Expected |
|---|------|----------|
| C1 | Run **Analyze** | Risk score, category, indicators, timeline, checklist populate |
| C2 | Confirm AI input uses redacted text | Raw file/PII not sent (redactedText preferred) |
| C3 | View/download an evidence file | Streams via authenticated proxy; HTML served as `text/plain` attachment |
| C4 | Open **Report Preview** | All sections render; non-accusatory language |
| C5 | **Download PDF** | Selectable-text PDF downloads as `fraudcase-report-{caseId}-{date}.pdf`; phones masked; CONFIDENTIAL watermark |
| C6 | Click **Print** | Native print dialog opens (fallback path intact) |

## D. Public Quick Check
| # | Step | Expected |
|---|------|----------|
| D1 | Open Quick Check (signed out) | Loads without auth; landing CTA + info icon work |
| D2 | Paste a scam SMS with phone/email | Result shows category/risk/indicators; redaction warnings list masked items |
| D3 | Confirm nothing is stored | No case/signal created for "Analyze only" |
| D4 | Exceed the daily scan cap (rapid submits) | `429` with a clear "free limit" message |

## E. Save Quick Check as private case
| # | Step | Expected |
|---|------|----------|
| E1 | Signed-out: click "Create a free account to save this" | Result stashed; routed to auth |
| E2 | Sign in / sign up | Private case auto-created from the redacted result; opens case detail |
| E3 | Signed-in: run Quick Check → "Save as private case" | Case created directly; opens it |
| E4 | Confirm no raw anonymous input persisted | Saved evidence uses redacted text only |

## F. Community signals (consent)
| # | Step | Expected |
|---|------|----------|
| F1 | On a Quick Check result, click "Share a redacted signal" | Consent panel with exact copy + Share/Cancel |
| F2 | Cancel | Nothing submitted |
| F3 | Confirm share | "Thanks. A redacted signal has been submitted for pattern review." |
| F4 | (Attempt) submit unredacted text via API | Rejected (400): privacy guard |

## G. Admin review
| # | Step | Expected |
|---|------|----------|
| G1 | Sign in as **admin**; open "Signals" | Dashboard loads: stats + table |
| G2 | Open a signal | Drawer shows redacted text, indicators, entities, privacy reminder |
| G3 | Mark **Reviewed** / **Useful** / **False positive** + add note | Status updates; stats refresh; note saved (re-redacted) |
| G4 | Confirm no raw identifiers/files shown | Only masked/derived data visible |

## H. Security / negative (must all be denied)
| # | Step | Expected |
|---|------|----------|
| H1 | User B opens User A's case URL/API (`/api/cases/{A_case}`) | **403** Forbidden |
| H2 | User B downloads User A's evidence file | **403** |
| H3 | **Non-admin** calls `/api/admin/community-signals` | **403**; "Signals" link not shown; page shows access-denied |
| H4 | **Anonymous** calls any `/api/cases…` or `/api/admin…` | **401** |
| H5 | Direct client read of `communitySignals` (Firestore SDK) | Denied by rules |
| H6 | Transfer case ownership via update (`ownerId`) | Rejected (server ignores client owner; rules immutable) |

---

## Sign-off
- [ ] All A–G flows pass.
- [ ] All H negative cases denied.
- [ ] No raw PII/credentials/files exposed anywhere (UI, PDF, signals, admin).
- [ ] `npm run lint` and `npm run build` pass.
