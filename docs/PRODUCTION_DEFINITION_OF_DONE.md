# FraudCase GH — Production Definition of Done

**Status:** Active launch criteria (2026-06-21)  
**Parent:** [`PRODUCTION_PLAN.md`](./PRODUCTION_PLAN.md)

Production-ready means FraudCase GH can be operated safely for real users in Ghana (and future regional expansion) with honest privacy messaging, abuse controls, and evidentiary discipline.

Use this checklist for **public launch** and for **sprint exit reviews**. Not every item is required for Sprint 1–5 internal milestones — see sprint columns.

Legend: **S1** Sprint 1 · **S2** Sprint 2 · **S3** Sprint 3 · **S4** Sprint 4 · **S5** Sprint 5 · **S6** Launch

---

## 1. Abuse protection and platform edge

| Criterion | Sprint | Verification |
|---|---|---|
| Public endpoints protected by App Check or equivalent | S2 | Failed request without valid token when enforced |
| CAPTCHA/Turnstile/reCAPTCHA on abuse-prone public actions | S2 | Bot submission blocked in test |
| Platform WAF/rate rules documented and deployed | S2 | WAF rule IDs documented |
| Shared rate limit store for multi-instance production | S2 | Two instances share counter |
| Strict file/body caps on public routes | S1–S2 | 413/429 tests |
| Gemini quota and billing alerts configured | S1 doc · S2 alert | Budget notification received in test |

---

## 2. Authentication and authorization

| Criterion | Sprint | Verification |
|---|---|---|
| Firebase Auth protects all private routes | Done | Anonymous → 401 |
| Server-side ID token verification | Done | Invalid token → 401 |
| `ownerId` isolation on all case/evidence routes | Done | Automated regression tests |
| `ownerId` never accepted from client for authz | Done | Update/transfer attempts fail |
| Admin routes require allowlist + token | Done | Non-admin → 403 |
| Admin review protected and auditable | S5 | Audit log entries without PII |

---

## 3. Firestore, Storage, and data boundaries

| Criterion | Sprint | Verification |
|---|---|---|
| Firestore rules deployed and tested | S2 | Direct client cross-owner read denied |
| Storage rules deployed; bucket private | S2 | Public URL access denied |
| No anonymous access to private cases/evidence/signals | Done | 401/403 |
| Public Quick Check ephemeral by default | Done | No Firestore write on analyze |
| No anonymous raw file storage | Done | Upload without auth rejected |
| Private evidence isolated per user/case | Done | Storage path + owner check |

---

## 4. Multimodal evidence (private)

| Criterion | Sprint | Verification |
|---|---|---|
| Screenshot/PDF extraction private-first | S3 | Route requires auth |
| Explicit consent before multimodal extraction | S3 | UI modal + server flag |
| Raw visual evidence handling documented honestly | S3 | Privacy copy reviewed |
| User informed Gemini processes private evidence for extraction | S3 | Consent text present |
| Raw OCR text not persisted to Firestore | S3 | Integration test |
| Redacted extracted text persisted | S3 | Firestore field inspection |
| Case analysis uses redacted approved artifacts only | S4 | Rejected extraction excluded |
| Two-pass pipeline (extract → redact → analyze) | S3–S4 | Code path review |

---

## 5. AI quality, grounding, and language

| Criterion | Sprint | Verification |
|---|---|---|
| AI findings source-grounded with evidence quotes | S3–S4 | Schema + tests |
| Extracted facts separated from AI inferences in UI | S4 | Badge/section review |
| Users can verify, correct, or reject extracted entities | S4 | Review controls work |
| Reports distinguish facts, indicators, caveats | S5 | PDF section review |
| No "confirmed fraud" wording | Done | Copy grep + test |
| No public accusations | Done | No public case listing |
| Indirect prompt injection test cases pass | S6 | Adversarial screenshot test |
| Heuristic fallback does not fabricate entities | Done | Unit tests |

---

## 6. Upload and download security

| Criterion | Sprint | Verification |
|---|---|---|
| Extension + MIME + magic-byte validation | Done | Spoofed file rejected |
| Size limits enforced | Done | Oversize → 413 |
| Sanitized filenames | Done | Path traversal blocked |
| Download proxy: nosniff, sandbox, attachment | Done | Header inspection |
| Request size and timeout controls (production) | S2 | Load test |

---

## 7. CI, security gates, and repository hygiene

| Criterion | Sprint | Verification |
|---|---|---|
| CI runs test, lint, build | S1 | GitHub Actions green |
| Dependency/security checks enabled | S1 | audit + Dependabot |
| Secret scanning enabled (platform + CI grep) | S1 | No keys in repo |
| No `.env` or service account JSON in git | Done | Pre-push audit |
| No AI tool provenance leaks in commits | Done | Log grep clean |
| Production README accurate | S1–S6 | Review each sprint |

---

## 8. Operations

| Criterion | Sprint | Verification |
|---|---|---|
| Production env checklist complete | S1 | [`PRODUCTION_ENV_CHECKLIST.md`](./PRODUCTION_ENV_CHECKLIST.md) |
| Deployment instructions documented | S2 | Operator can deploy |
| Rollback instructions documented and tested | S2 | One rollback drill |
| Monitoring and error logging configured | S2 | 5xx/latency dashboard |
| Structured audit logging without sensitive content | S2 | Log sample review |
| Production readiness report exists | S6 | Signed checklist |
| Full E2E suite | S6 | CI or manual matrix |
| Abuse/load smoke tests | S6 | 429 under flood |
| Upload security tests | S3–S6 | Malware/disguise cases |
| Privacy regression tests | S4–S6 | Redaction persistence |

---

## 9. Public multimodal (future — not launch blocker if deferred)

Public screenshot/PDF Quick Check is **not** required for initial launch if all private multimodal and abuse controls above are met. When enabled:

| Prerequisite | Required |
|---|---|
| App Check enforced | Yes |
| CAPTCHA on upload/analyze | Yes |
| WAF + shared rate limiter | Yes |
| Strict file caps + billing alerts | Yes |
| Privacy notice for ephemeral Gemini processing | Yes |

---

## Sprint 1 exit criteria (current milestone)

Sprint 1 is done when:

- [x] Research imported under `docs/research/` with README
- [x] Production plan, agent playbook, definition of done published
- [ ] CI workflow green on `main`
- [ ] Dependabot configured
- [ ] Owner-isolation regression tests pass
- [ ] App Check implementation plan documented
- [ ] Shared rate limit plan documented
- [ ] Gemini quota/billing doc published
- [ ] Production env checklist published
- [ ] README updated for production posture (not portfolio-only)
- [ ] Secret/provenance audit clean

---

## Sign-off template (Sprint 6 / launch)

```
Release: ___________
Date: ___________
Owner: ___________

CI: pass / fail
Owner isolation tests: pass / fail
Rules deployed: pass / fail
App Check + CAPTCHA: pass / fail
Billing alerts: pass / fail
E2E matrix: pass / fail
Rollback tested: pass / fail
Known limitations documented: yes / no

Approved for public launch: yes / no
```

---

_Last updated: 2026-06-21_
