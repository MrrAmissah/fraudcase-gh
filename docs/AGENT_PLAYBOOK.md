# FraudCase GH — Agent Playbook

**Status:** Active (2026-06-21)  
**Parent:** [`PRODUCTION_PLAN.md`](./PRODUCTION_PLAN.md)

This playbook defines how Claude Code agents (and human operators) implement FraudCase GH as **production software**, not a portfolio MVP.

---

## Agent roles

| Agent | Owns |
|---|---|
| **Architect** | Architecture boundaries, phase sequencing, schema contracts, public vs private capabilities |
| **Security** | Auth, owner isolation, upload security, abuse controls, prompt injection, secrets, privacy |
| **Backend** | Express, Firebase Admin, Gemini, Storage, API routes, rate limiting, App Check middleware |
| **Frontend** | Quick Check, Case Detail, evidence verification UI, visual summaries, report UX |
| **QA** | Unit, integration, owner-isolation, abuse, upload, E2E tests |
| **Docs/release** | README, production docs, changelog, release readiness, rollback notes |

Agents may overlap on small tasks; Security has **veto** on high-risk changes.

---

## Non-negotiable rules

### Secrets and provenance

- No `.env` commits
- No service account JSON in git
- No Google ADC credential files in repo
- No real user evidence in commits or tests
- No real phone numbers or private chat transcripts in fixtures
- No Claude/Codex internal files (`CLAUDE.md`, `.claude/`, etc.)
- No `Co-authored-by:` trailers in commits

### Product and legal safety

- No **"confirmed fraud"** language
- No legal guilt declarations
- No public scammer directory
- No doxxing or public accusations
- Community signals remain redacted pattern contributions only

### Security invariants — never weaken

- Firebase Auth on all private routes
- Server-side token verification (`verifyIdToken`)
- `ownerId` from token only — never from client body for authorization
- Firestore/Storage owner isolation checks on every case-scoped operation
- Redaction before AI and before anonymous persistence
- Upload validation (extension, MIME, magic bytes, size caps)
- No raw anonymous file storage
- No hallucination-prone features without grounding + review workflow

### Engineering discipline

- No broad rewrites unless clearly justified
- Keep commits small, reviewable, and tested
- Do not silently remove features
- When a feature is risky, **solve the risk** — do not defer to "MVP later" without production controls plan
- Preserve working functionality while hardening

---

## Workflow per task

### Before code changes

```bash
git status --short
git branch --show-current
git log -5 --oneline
npm test
npm run lint
npm run build
```

Report failures before proceeding.

### During implementation

1. Read relevant production doc section and existing code conventions.
2. Minimal diff aligned with current patterns (`server.ts`, `src/lib/security/*`, components).
3. Add or update tests for behavior changed.
4. Update docs when behavior or env vars change.

### After meaningful changes

```bash
npm test
npm run lint
npm run build
```

Report:

- Files changed
- Risk/security impact
- What was **not** done (if deferred, cite sprint + prerequisite)

### Commits

- Atomic, conventional prefixes: `feat:`, `fix:`, `docs:`, `ci:`, `test:`, `chore:`
- Commit locally when clean; **do not push** unless user approves
- Never commit secrets

---

## Agent prompts (templates)

**Architect:**  
"Given [task], confirm boundaries against PRODUCTION_PLAN.md. Propose minimal sequence. Flag public vs private impact."

**Security:**  
"Audit [task] for auth, ownerId, uploads, abuse, secrets, privacy, prompt injection. Block if high risk."

**Backend:**  
"Implement [task] in Express/Firebase/Gemini with tests. Use existing redaction and validation helpers."

**Frontend:**  
"Implement [task] in React with accessible UI. Distinguish verified extraction vs AI inference. No accusatory copy."

**QA:**  
"Add tests for [task]: happy path, 401/403 owner isolation, abuse limits, upload rejection. No real PII fixtures."

**Docs/release:**  
"Update README/docs from merged facts. Align PRODUCTION_READINESS checklist. Neutral provenance wording."

---

## Sprint ownership map

| Sprint | Lead agent | Support |
|---|---|---|
| 1 Foundation | Docs/release + QA | Security (CI, secret scan) |
| 2 Hardening | Backend + Security | Architect |
| 3 Multimodal | Backend + Architect | Security, Frontend |
| 4 Verification UI | Frontend | QA, Backend |
| 5 Reports/admin | Frontend + Backend | Docs/release |
| 6 Release | QA + Docs/release | All |

---

## Multimodal-specific agent rules

1. Private authenticated routes only until public abuse controls ship.
2. Explicit user consent before Gemini processes screenshot/PDF.
3. Pass A extract-only; pass B analyze redacted text only.
4. Persist redacted artifacts — never raw OCR to Firestore.
5. Separate extraction schema from case analysis schema.
6. Human review gate for weak grounding.
7. UI labels: **Verified from evidence** vs **Possible indicator (AI inference)**.

---

## Forbidden shortcuts

| Shortcut | Why forbidden |
|---|---|
| Skip ownerId check "just this once" | Cross-tenant data leak |
| Store Quick Check uploads to disk | Anonymous PII retention |
| Send unredacted text to Gemini for case analysis | Privacy violation |
| Disable rate limits "temporarily" in prod | Cost/abuse |
| Add public multimodal without App Check | Production blocker |
| Fabricate entities in tests beyond evidence | Violates product trust model |

---

## Escalation

Stop and ask the user when:

- Changing public vs private capability boundaries
- Adding new third-party data processors
- Weakening auth, rules, or redaction
- Launching or pushing to production remote
- Unclear legal/copy implications

---

## Reference documents

- [`PRODUCTION_PLAN.md`](./PRODUCTION_PLAN.md)
- [`PRODUCTION_DEFINITION_OF_DONE.md`](./PRODUCTION_DEFINITION_OF_DONE.md)
- [`PRODUCTION_ENV_CHECKLIST.md`](./PRODUCTION_ENV_CHECKLIST.md)
- [`APP_CHECK_IMPLEMENTATION_PLAN.md`](./APP_CHECK_IMPLEMENTATION_PLAN.md)
- [`SHARED_RATE_LIMIT_PLAN.md`](./SHARED_RATE_LIMIT_PLAN.md)
- [`GEMINI_QUOTA_AND_BILLING.md`](./GEMINI_QUOTA_AND_BILLING.md)
- [`research/README.md`](./research/README.md)

---

_Last updated: 2026-06-21_
