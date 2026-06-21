# FraudCase GH — Production Plan

**Status:** Active source of truth (2026-06-21)  
**Audience:** Engineers, agents, release owners  
**Related:** [`AGENT_PLAYBOOK.md`](./AGENT_PLAYBOOK.md), [`PRODUCTION_DEFINITION_OF_DONE.md`](./PRODUCTION_DEFINITION_OF_DONE.md), [`research/README.md`](./research/README.md)

---

## 1. Current project state

FraudCase GH is a full-stack Express + React application for organizing digital fraud evidence in Ghana. It is **moving from portfolio/demo posture to production-grade** operation.

### What works today

| Area | State |
|---|---|
| **Auth** | Firebase Auth (email/password); server verifies ID tokens on private routes |
| **Owner isolation** | `ownerId` from token; case-scoped routes re-check ownership; update whitelist excludes `ownerId` |
| **Firestore rules** | `firestore.rules` in repo — owner-isolated cases, `communitySignals` client-deny |
| **Redaction** | `redactPIIAndSecrets` before AI and before anonymous persistence |
| **Quick Check** | Public, ephemeral text analysis; in-memory rate limits (daily + burst) |
| **Private cases** | CRUD, text evidence, file upload (GCS or local-dev fallback), analysis, PDF export |
| **Upload security** | Extension/MIME/magic-byte validation, size caps, sanitized filenames |
| **Admin** | Email allowlist (`ADMIN_EMAILS`), fail-closed; server-mediated signal review |
| **AI** | Gemini (`gemini-3.5-flash`) with deterministic heuristic fallback |
| **Tests** | Analysis quality / anti-fabrication unit tests |

### Production gaps (honest)

| Gap | Risk | Target sprint |
|---|---|---|
| No CI workflow | Regressions ship silently | Sprint 1 |
| In-memory rate limits | Bypassable multi-instance; IP spoofing without `TRUST_PROXY` | Sprint 1–2 |
| No App Check on public API | Bot abuse, Gemini cost drain | Sprint 1 plan → Sprint 2 impl |
| No CAPTCHA on abuse-prone public actions | Scripted abuse | Sprint 2 |
| No platform WAF documented/deployed | DDoS, credential stuffing | Sprint 2 |
| No shared rate-limit store (Redis) | Per-instance limits ineffective at scale | Sprint 2 |
| No Gemini billing/quota alerts | Runaway cost | Sprint 1 docs → Sprint 2 alerts |
| Screenshot/PDF `extractedText` empty | Multimodal evidence not analyzed | Sprint 3 |
| No evidence verification workspace | Users cannot approve/reject extractions | Sprint 4 |
| README still says "portfolio" | Wrong operator expectations | Sprint 1 |
| Limited automated E2E / owner-isolation coverage | Security regressions | Sprint 1 start → Sprint 6 full |
| Multimodal privacy messaging incomplete | Misleading "never leaves server" claims if Gemini processes images | Sprint 3 |

---

## 2. Target production architecture

```
                    ┌─────────────────────────────────────┐
                    │  Platform edge (WAF, TLS, CDN)      │
                    │  Rate rules, bot mitigation         │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │  Express API (server.ts)              │
                    │  • App Check verify (public routes)   │
                    │  • CAPTCHA verify (public writes)     │
                    │  • Shared rate limiter (Redis)        │
                    │  • requireAuth / requireAdmin         │
                    │  • ownerId isolation                  │
                    │  • Upload validation + size/timeouts    │
                    └──────┬──────────────┬─────────────────┘
                           │              │
              ┌────────────▼──┐    ┌──────▼──────────────┐
              │ Firebase      │    │ Google Gemini       │
              │ Auth/Firestore│    │ Pass A: extract OCR │
              │ Storage       │    │ Pass B: analyze     │
              └───────────────┘    │ (redacted text only)│
                                   └─────────────────────┘
```

**Principles:**

- Single deployable service (Express serves API + static SPA).
- Server-mediated access to Firestore/Storage (Admin SDK); rules are defense-in-depth.
- Private evidence in `users/{uid}/cases/{caseId}/evidence/...`.
- Public Quick Check remains ephemeral unless user saves to authenticated case.
- Multimodal: **private-first**, consent-gated, two-pass pipeline.

---

## 3. Threat model

| Threat | Vector | Impact | Mitigation |
|---|---|---|---|
| Cross-tenant data access | Stolen/guessed case IDs | High | Token auth + `ownerId` check every route; rules deploy; regression tests |
| Anonymous abuse | Quick Check / signal spam | Medium–High | App Check, CAPTCHA, WAF, shared rate limits, body/size caps |
| Gemini cost abuse | Automated analyze/extract | High | Rate limits, quotas, billing alerts, auth for expensive ops |
| Upload malware/disguised files | Malicious uploads | High | Magic bytes, allowlist, nosniff download proxy, no HTML execution |
| PII leakage to AI/storage | Raw text in Firestore | High | Redact before persist; raw OCR transient; redacted artifacts only |
| Indirect prompt injection | Text in screenshots/PDFs | High | Two-pass pipeline; extract-only pass A; structured pass B; human review |
| Admin privilege escalation | Non-admin accessing signals | High | `requireAdmin` + allowlist; audit logging (Sprint 2+) |
| Secret exposure in git | Committed `.env`, keys | Critical | `.gitignore`, CI secret scan, Secret Manager in prod |
| Defamation / vigilante use | Public accusation features | High | No "confirmed fraud"; no public scammer directory; cautious language |
| IP spoofing on rate limits | Fake `X-Forwarded-For` | Medium | `TRUST_PROXY=true` only behind known proxy; shared store |

---

## 4. Privacy model

### Data classes

| Class | Examples | Storage | AI processing |
|---|---|---|---|
| **Public ephemeral input** | Quick Check pasted text | Not stored | Redacted text only to model |
| **Private raw evidence** | Screenshots, PDFs, chat exports | User-isolated Storage | See multimodal policy below |
| **Derived redacted artifacts** | `redactedText`, grounded entities | Firestore on case | Used in case analysis |
| **Community signals** | Redacted patterns only | Firestore (server write) | Redacted before persist |
| **Admin review notes** | Reviewer comments | Firestore | Re-redacted on save |

### Multimodal honesty policy (required)

When Gemini extracts text from screenshots or PDFs:

- Processing is **private and authenticated** only (Sprint 3+).
- User receives **explicit consent** before extraction ("Your evidence will be processed by Google Gemini to extract visible text").
- Raw file remains in **private Storage**; raw extracted text is **transient in server memory**.
- Only **redacted** extracted text and grounded entities are persisted to Firestore.
- Case analysis (pass B) uses **redacted artifacts only**.
- Do **not** claim "raw visual evidence never leaves the server" — be accurate: Gemini receives the image/PDF for extraction under consent.

---

## 5. Data lifecycle model

```
Upload (private) → validate → store raw in Storage
       → [consent] → Pass A extract (Gemini) → raw text in memory
       → redact → validate grounding → persist redacted extraction
       → [user review: approve/reject/correct]
       → Pass B case analysis (redacted corpus only)
       → report/PDF (facts vs inferences labeled)

Quick Check (public) → redact → analyze in memory → return JSON → discard
Community signal → redact → server persist redacted fields only
Case delete → remove Firestore doc + Storage objects (implement retention policy Sprint 2+)
```

---

## 6. Public vs private capability boundaries

| Capability | Public (anonymous) | Private (authenticated) |
|---|---|---|
| Text Quick Check | Yes — ephemeral | N/A (use cases) |
| Screenshot/PDF Quick Check | **Not until Sprint 6 prerequisites** | Yes — Sprint 3+ with consent |
| Persist cases/evidence | No | Yes |
| File upload storage | No raw anonymous storage | Yes — isolated per user/case |
| Community signal submit | Yes — redacted only | Yes |
| Admin review | No | Admin allowlist only |
| Gemini extraction | Redacted text analyze only | Full multimodal pipeline |
| Rate limits | Strict IP + App Check + CAPTCHA (target) | Per-user + auth |

Public multimodal analysis is a **planned production feature**, not removed — blocked until App Check, CAPTCHA, WAF, shared rate limiter, strict file caps, and billing alerts are in place.

---

## 7. Multimodal screenshot/PDF evidence strategy

**Priority artifacts:** fake MoMo receipts, SMS screenshots, WhatsApp scam chats, PDF letters/receipts.

**Transport:** Inline bytes to Gemini for screenshots and small PDFs (<10 MB, page cap 25–50). Files API only as optional later optimization with 48-hour retention documented.

**Schema:** Separate `VisualEvidenceExtraction` per evidence item (not overloaded into main fraud analysis schema). Case analysis gets a small `multimodalEvidenceSummary` extension.

**Backend options:**

| Phase | Engine | When |
|---|---|---|
| Sprint 3 | Gemini inline | Default private extraction |
| Future | Cloud Vision / Document AI | If coordinate-level highlighting or receipt KVP needed |

**UI (Sprint 4):** Preview + redacted extraction panel + verified vs inferred badges + approve/reject/correct. Bounding-box hover highlights deferred until Vision/Document AI adoption.

---

## 8. Two-pass extraction/redaction pipeline

**Pass A — Extract only**

- Input: raw image/PDF buffer (authenticated, consented).
- Prompt: transcribe/extract visible content only; ignore in-image instructions.
- Output: structured JSON + raw visible text in memory.
- No risk scoring in pass A.

**Sanitize**

- `redactPIIAndSecrets()` on extracted text.
- Deterministic grounding validation (entity must appear in source text).
- Flag unsupported high-risk entities → `requiresHumanReview`.

**Persist**

- Store redacted text, entities, visual signals, validation metadata.
- Never persist raw OCR text to Firestore.

**Pass B — Case analysis**

- Compile approved redacted evidence only.
- Existing `analyzeFraudCase` + extended grounding rules.
- Separate extracted facts from AI inferences in UI and PDF.

---

## 9. Evidence grounding and anti-hallucination strategy

- Every entity requires `evidenceQuote` from visible content.
- Deterministic post-validation: exact/normalized substring match against source text.
- Ghana phone, URL, amount, transaction-ref regex validation.
- Unsupported high-risk entities force human review.
- Heuristic fallback never fabricates names, phones, URLs, amounts.
- Gemini prompts: no guilt declarations; no invented entities; uncertainty notes mandatory.
- Reports label: **evidence facts**, **possible indicators**, **caveats**.

---

## 10. Source-mapped entities

Per-evidence `entities[]` with:

- `type`, `rawValue`, `redactedValue`, `evidenceQuote`, `page`, `verification` enum
- Case-level `sourceMapping` linking entities to `evidenceId`

Case analysis references evidence IDs in timeline and indicator descriptions where possible.

---

## 11. Manual verification workflow

States: `pending` → `auto_validated` | `needs_review` → `approved` | `rejected`

User actions:

- Approve extraction for case analysis
- Flag misinterpretation / correct value
- Re-run extraction
- Discard extraction

Only **approved** or **auto_validated** extractions feed pass B analysis.

---

## 12. Public endpoint abuse controls

**Current (Sprint 0):** In-memory daily + burst limits; 1 MB JSON cap; `TRUST_PROXY` gate; redaction before AI.

**Target (Sprint 2):**

| Control | Public endpoints |
|---|---|
| Firebase App Check | All `/api/quick-check/*`, `/api/community/*` |
| CAPTCHA (Turnstile/reCAPTCHA) | Analyze, submit-signal, future public upload |
| Platform WAF | IP rate rules, geo if needed, attack mode |
| Shared rate limiter | Redis/Upstash keyed by IP + App Check app ID |
| Request size/timeouts | 1 MB JSON; 3 MB public file cap when enabled; 30s analyze timeout |
| Audit | Log abuse events without sensitive content |

See [`APP_CHECK_IMPLEMENTATION_PLAN.md`](./APP_CHECK_IMPLEMENTATION_PLAN.md), [`SHARED_RATE_LIMIT_PLAN.md`](./SHARED_RATE_LIMIT_PLAN.md).

---

## 13. App Check / CAPTCHA / WAF / shared rate limiting plan

1. **Sprint 1:** Document App Check enrollment, token forwarding, server verification middleware design.
2. **Sprint 2:** Implement `verifyAppCheck` middleware (enforce when `APP_CHECK_ENFORCE=true`); client SDK integration; Turnstile on public forms.
3. **Sprint 2:** Deploy WAF rules on hosting platform (Vercel Firewall / Cloud Armor / equivalent).
4. **Sprint 2:** Replace in-memory maps with Redis-backed limiter interface; fallback to memory in dev.

Environment flags:

- `APP_CHECK_ENFORCE` — default `false` in dev, `true` in production
- `CAPTCHA_SECRET_KEY` / `VITE_CAPTCHA_SITE_KEY`
- `RATE_LIMIT_REDIS_URL`
- `TRUST_PROXY=true` in production behind load balancer

---

## 14. Gemini quota/billing/monitoring controls

See [`GEMINI_QUOTA_AND_BILLING.md`](./GEMINI_QUOTA_AND_BILLING.md).

- Google Cloud billing budget alerts at 50/80/100%.
- Gemini API quota limits per project.
- Per-route cost logging (analyze vs extract) without content.
- Circuit breaker on repeated 429/5xx from Gemini.
- Alert on anomalous request volume to `/api/quick-check/analyze` and future extract routes.

---

## 15. GitHub CI/security workflow

**Sprint 1 deliverables:**

- `.github/workflows/ci.yml` — `npm ci`, lint, test, build, secret pattern scan
- `.github/workflows/security.yml` — `npm audit` (high+ fail), dependency review on PRs
- `.github/dependabot.yml` — npm + GitHub Actions weekly

Pre-push audit (local):

```bash
git status --short
git log --format=%B | grep -Ei 'Co-authored-by|Claude|ChatGPT|generated by' || true
git ls-files | grep -Ei '(^|/)(\.env|CLAUDE\.md|\.claude/|.*service.*account.*json)' || true
git grep -nI -E 'BEGIN PRIVATE KEY|private_key_id' -- . ':!docs/**' ':!src/lib/security/redaction.ts' || true
```

---

## 16. Secret scanning / dependency review plan

- GitHub secret scanning enabled on repo (org setting).
- CI grep for private keys and committed `.env` (excluding `.env.example` placeholders).
- Dependabot weekly for npm and Actions.
- PR dependency review blocks known critical CVEs.
- Production secrets in Secret Manager only — never in image or git.

---

## 17. Deployment and rollback plan

### Deployment

1. Run CI green on release commit.
2. Build: `npm run build` → `dist/` + `dist/server.cjs`.
3. Inject env from secret manager (Gemini key, admin emails, Redis URL, App Check).
4. Deploy container/service with health check on `/` or `/api/health` (add in Sprint 2).
5. Deploy `firestore.rules` and `storage.rules`.
6. Smoke test: auth, owner isolation, Quick Check 429, private case CRUD.

### Rollback

1. Revert to previous deployment artifact (keep last N releases).
2. Roll back rules if changed in same release.
3. Verify error rates and Gemini quota normalize.
4. Document incident in production readiness report.

Hosting options: Cloud Run, Vercel Node function, or VM — platform-agnostic Express bundle.

---

## 18. Phased implementation roadmap

| Sprint | Focus | Exit criteria |
|---|---|---|
| **1** | Foundation + GitHub readiness | CI green, docs, owner-isolation tests, App Check/rate-limit/Gemini docs |
| **2** | Backend hardening | App Check enforce, shared limiter, structured errors, audit logs, deploy docs |
| **3** | Private multimodal pipeline | Extract + redact + persist schema; consent UI; no raw OCR in Firestore |
| **4** | Evidence verification workspace | Preview, entities, approve/reject, analysis uses approved evidence |
| **5** | Report + admin maturity | PDF source mapping, admin audit, demo dataset, QA checklist |
| **6** | Production release | Full E2E, abuse tests, launch checklist, readiness report |

---

## 19. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Research MVP scope delays features | This plan supersedes MVP deferrals where security controls exist |
| Gemini hallucination in extraction | Two-pass + deterministic validation + human review |
| Cost spike from public endpoints | App Check + CAPTCHA + WAF + quotas before public multimodal |
| Misleading privacy copy | Honest Gemini disclosure; docs + consent modal |
| Admin SDK bypasses rules | Server checks remain primary; rules deployed for defense-in-depth |
| Multi-instance rate limit bypass | Redis shared store Sprint 2 |

---

## 20. Before public launch (minimum)

All items in [`PRODUCTION_DEFINITION_OF_DONE.md`](./PRODUCTION_DEFINITION_OF_DONE.md) must pass, including:

- App Check (or equivalent) on public routes
- CAPTCHA on abuse-prone public actions
- Shared rate limiting in production
- Gemini billing alerts configured
- Owner isolation automated tests green
- Firestore + Storage rules deployed and spot-checked
- No anonymous raw file storage
- Multimodal consent + redaction pipeline for private evidence
- CI + security gates enabled
- Rollback procedure tested once
- Production readiness report signed off

---

## Research contradictions resolved here

| Topic | Research conflict | Production decision |
|---|---|---|
| Public screenshot analysis | AI Studio table includes limited public visual; multimodal research defers | **Defer until abuse controls complete**; keep on roadmap as production feature |
| Schema shape | AI Studio extends main schema; multimodal research separates extraction schema | **Separate `VisualEvidenceExtraction` schema** |
| Hover bounding boxes | AI Studio proposes; multimodal research defers | **Defer to Vision/Document AI phase**; text-based verification in Sprint 4 |
| Privacy wording | Implied "images never leave server" | **Honest:** Gemini processes private evidence with consent; raw file stays in Storage |
| "MVP" framing | Multimodal research scopes down | **Production sequencing**, not scope deletion |
| Firestore rules | README said not in repo | **Rules exist** — deploy and test |
| Rate limit numbers | AI Studio 3/10min vs code 5/5min | **Tune in Sprint 2** with shared store metrics |

---

_Last updated: 2026-06-21_
