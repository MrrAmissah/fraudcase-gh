<div align="center">
  <img src="public/brand/fraudcase-wordmark.png" alt="FraudCase GH" width="360" />
</div>

# FraudCase GH

> A privacy-first web app that helps people in Ghana organize digital-scam evidence, understand the risk, and produce a clean, non-accusatory incident report — without doxxing, shaming, or declaring anyone guilty.

**Live:** https://fraudcase-gh.vercel.app

FraudCase GH turns a confusing pile of suspicious SMS, WhatsApp messages, links, screenshots, and Mobile Money receipts into a structured case file with an AI-assisted risk assessment, **AI-extracted (and user-verified) evidence facts**, a timeline, an evidence checklist, and a downloadable PDF report suitable for sharing with a bank, mobile-money operator, or the National Cyber Security Authority.

> **Positioning:** FraudCase GH is a decision-support and evidence-organization tool — **not** a law-enforcement system and **not** a verdict on any person.

---

## Table of contents
- [Problem statement](#problem-statement)
- [Key features](#key-features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Security & privacy model](#security--privacy-model)
- [AI safety & non-accusatory positioning](#ai-safety--non-accusatory-positioning)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Further documentation](#further-documentation)

---

## Problem statement

Digital fraud is widespread in Ghana: fake delivery/clearance-fee smishing (e.g. spoofed `GH-POST` senders), Mobile Money "wrong transfer / reversal" tricks, WhatsApp task-and-deposit recruitment scams, and credential-phishing links. When someone is targeted they face three problems:

1. **Disorganized evidence** — screenshots, texts, links, and receipts scattered and easy to lose.
2. **Uncertainty about risk** — hard to tell how dangerous a message is, or what to do next.
3. **Risk of overreaction** — public "name and shame" can defame innocent people and expose the victim's own data.

FraudCase GH **organizes** evidence into a private case, **assesses** risk with cautious AI, and **frames** everything as non-accusatory decision support — while **redacting** sensitive data before any of it reaches a model.

---

## Key features

- **Quick Check (public, no sign-up).** Paste a suspicious message/link and get an instant, ephemeral risk read-out. Input is **redacted before analysis** and **nothing is stored**.
- **Private case workspace (authenticated).** Owner-isolated cases: add text evidence, upload files, run analysis.
- **Multimodal evidence extraction.** Upload a screenshot or PDF and the app extracts visible facts (phone numbers, amounts, links, references) via Gemini, **redacts** them, and stores **only the redacted artifact** (never raw OCR). Consent-gated and feature-flagged.
- **Verification workspace.** A split-screen review where you **Accept / Reject** each extracted fact. Facts stay *suggestions* until you accept them, and **only accepted facts feed the analysis** (no auto-trust).
- **AI-assisted analysis.** Risk score and category, possible fraud indicators, extracted entities, a timeline, an evidence checklist, and recommended next steps — grounded in the evidence you provide.
- **Heuristic fallback.** If the model is unavailable, a deterministic, **non-fabricating** heuristic still produces a safe structured result.
- **Consent-gated community signals + admin review.** Optionally contribute a **redacted** signal; an allowlisted admin can review patterns (fail-closed).
- **Downloadable PDF report.** Clean, dossier-style export generated client-side.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, `motion`, `lucide-react` — hosted on **Vercel** |
| PDF / sanitization | `jsPDF`, `html2canvas`, `DOMPurify` (client-side export) |
| Backend | Node.js, Express, `tsx` (dev), `esbuild` bundle (prod) — containerized on **Google Cloud Run** |
| Auth / Data / Files | Firebase Authentication (email/password), Cloud Firestore (named DB), Firebase Cloud Storage |
| Server credentials | Firebase Admin SDK via **Application Default Credentials (ADC)** — no service-account keys |
| AI | Google **Gemini `gemini-2.5-flash`** via `@google/genai` — **Vertex AI (ADC)** in production, or the Gemini API key elsewhere; deterministic heuristic fallback |
| Tests / CI | `node:test` via `tsx`; GitHub Actions (test/lint/build + npm-audit + provenance) |

---

## Architecture

**Production** separates the public frontend from the private-ish backend, but the app stays a single codebase:

```
Browser ──(/api/*, Authorization: Bearer <Firebase ID token>)──► Vercel (static SPA + rewrite)
                                                                 └─► Cloud Run (Express API)
                                                                      ├─ Firebase Auth  (verifyIdToken)
                                                                      ├─ Cloud Firestore (cases, facts, signals)
                                                                      ├─ Cloud Storage  (evidence files)
                                                                      └─ Vertex AI Gemini (extraction + analysis)
```

- **Vercel** hosts the built SPA and rewrites `/api/*` to Cloud Run (`vercel.json`), so the browser stays same-origin (no CORS) and no backend secret is exposed client-side.
- **Cloud Run** runs the Express server. It enforces its own Firebase auth + owner-isolation on every route; Gemini calls run server-side via Vertex AI (ADC), so **no Gemini key ships to the browser**.
- **Locally / in dev**, the same `server.ts` serves both the API and the Vite SPA on port `3000`.

See [`docs/ARCHITECTURE_OVERVIEW.md`](docs/ARCHITECTURE_OVERVIEW.md) for the component/request-flow detail.

---

## Security & privacy model

- **Token-verified API.** Protected endpoints require a verified `Authorization: Bearer <Firebase ID token>` (`adminAuth.verifyIdToken`).
- **Owner isolation (`ownerId`).** Cases are queried per-uid and every case-scoped route re-checks ownership. `ownerId` comes only from the verified token; updates whitelist editable fields so ownership can't be reassigned.
- **Redaction before AI / at rest.** `redactPIIAndSecrets` masks Ghana Card numbers, emails, phone numbers, card/bank numbers, API keys/tokens, and PIN/OTP codes. Extraction persists **only redacted artifacts** (no raw OCR), and audit records carry **counts only** (no transcribed content).
- **No auto-trust.** Extracted facts are suggestions until a user accepts them; only accepted facts reach analysis.
- **Ephemeral Quick Check.** Public results are computed and returned without being stored.
- **Fail-closed admin.** Admin review requires an allowlisted email (`ADMIN_EMAILS`); unset ⇒ no admins.
- **No public scammer directory.**

Full detail (with code references) is in [`docs/SECURITY_PRIVACY_OVERVIEW.md`](docs/SECURITY_PRIVACY_OVERVIEW.md). Storage rules: [`docs/STORAGE_RULES.md`](docs/STORAGE_RULES.md).

---

## AI safety & non-accusatory positioning

- **No guilt declarations.** Prompts/system instructions forbid framing anyone as a confirmed criminal; outputs use cautious language ("possible indicators", "risk signals") with a disclaimer. Evidence text is treated strictly as data — injected instructions inside evidence are never obeyed.
- **Evidence grounding.** Extracted entities/facts must come from the supplied evidence only; absent values stay empty rather than invented. The heuristic fallback follows the same rule.
- **Risk as decision support**, not a verdict. No doxxing, public shaming, or "scammer lists".

---

## Local setup

**Prerequisites:** Node.js 18+, a Firebase project (Auth + Firestore + Storage), and either the `gcloud` CLI (for ADC) or a service-account JSON. Optionally a Gemini API key.

```bash
npm install
cp .env.example .env                 # fill in values (see table below)
gcloud auth application-default login # server credentials (ADC)
gcloud config set project <your-firebase-project-id>
# enable Email/Password sign-in in the Firebase console
npm run check:env                    # report which vars/credentials are detected (no values printed)
npm run dev                          # http://localhost:3000
```

| Command | Purpose |
|---|---|
| `npm run dev` | Full-stack dev server (API + Vite) |
| `npm run build` | Build the client + bundle the server to `dist/` |
| `npm start` | Run the production bundle (`dist/server.cjs`) |
| `npm run lint` | Type-check (`tsc --noEmit`) |
| `npm test` | Run the test suite (`node:test` via `tsx`) |

---

## Environment variables

No secret values are shown here. See `.env.example`; real values belong only in your git-ignored `.env`.

| Variable | Scope | Required? | Notes |
|---|---|---|---|
| `VITE_FIREBASE_*` (7 keys) | Client (build-time) | Yes | Firebase **web** config — public by design (ships in the bundle) |
| `MULTIMODAL_EXTRACTION_ENABLED` | Server | No | `true` enables image/PDF extraction (default off) |
| `GOOGLE_GENAI_USE_VERTEXAI` | Server | No | `true` routes Gemini through Vertex AI (ADC, Cloud-billed); else uses `GEMINI_API_KEY` |
| `GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_LOCATION` | Server | No | Vertex project/region (defaults: project id / `us-central1`) |
| `GEMINI_API_KEY` | Server | No | Used only when not in Vertex mode; unset ⇒ heuristic fallback |
| `GEMINI_MODEL` | Server | No | Override the model (default `gemini-2.5-flash`) |
| `FIRESTORE_DATABASE_ID` | Server | No | Override the server Firestore DB id (default: provisioned named DB) |
| `ADMIN_EMAILS` | Server | No | Admin allowlist; **fail-closed** if empty |
| `GOOGLE_APPLICATION_CREDENTIALS` | Server | No | Service-account JSON path; **not needed with ADC / on Cloud Run** |

> Firebase **web** keys are not secrets — they identify the project and are protected by rules/App Check, not by being hidden. Server-side values (`GEMINI_API_KEY`, service-account credentials) **are** secrets and must never be committed or shipped to the browser.

---

## Deployment

- **Frontend → Vercel:** see [`docs/VERCEL_DEPLOY.md`](docs/VERCEL_DEPLOY.md) (build, `/api/*` rewrite to Cloud Run, env, custom domain).
- **Backend → Cloud Run:** see [`docs/DEPLOYMENT_RUNBOOK.md`](docs/DEPLOYMENT_RUNBOOK.md) (container build, `NODE_ENV=production`, runtime SA / ADC, secrets, rollback).

---

## Roadmap

- **Done & live:** Quick Check, private cases, AI analysis, **multimodal extraction + verification workspace**, community signals + admin review, PDF export, Vercel + Cloud Run + Vertex AI deployment.
- **In progress:** **Threat-intelligence "Risk signals"** — Tier-0 local indicators + UI panel and passive Web Risk / VirusTotal providers, all **behind default-off flags** (accepted-facts-only, server-side, non-accusatory). Setup/status: [`docs/THREAT_INTEL_PROVIDERS.md`](docs/THREAT_INTEL_PROVIDERS.md); design: [`docs/THREAT_INTEL_ENRICHMENT_PLAN.md`](docs/THREAT_INTEL_ENRICHMENT_PLAN.md).
- **Hardening:** shared rate limiter, App Check / CAPTCHA, deployed rules + route owner-isolation tests, abuse/load/prompt-injection suite.
- **Product:** custom domain, signed URLs for evidence files, multi-language (Twi/Pidgin) extraction, scoped case sharing, optional reporting integrations.

---

## Further documentation

- [`docs/ARCHITECTURE_OVERVIEW.md`](docs/ARCHITECTURE_OVERVIEW.md) — components & request flows
- [`docs/SECURITY_PRIVACY_OVERVIEW.md`](docs/SECURITY_PRIVACY_OVERVIEW.md) — security & privacy model
- [`docs/STORAGE_RULES.md`](docs/STORAGE_RULES.md) — Cloud Storage rules
- [`docs/VERCEL_DEPLOY.md`](docs/VERCEL_DEPLOY.md) — frontend hosting
- [`docs/DEPLOYMENT_RUNBOOK.md`](docs/DEPLOYMENT_RUNBOOK.md) — backend deploy & rollback
- [`docs/THREAT_INTEL_ENRICHMENT_PLAN.md`](docs/THREAT_INTEL_ENRICHMENT_PLAN.md) — threat-intel design/roadmap
- [`docs/THREAT_INTEL_PROVIDERS.md`](docs/THREAT_INTEL_PROVIDERS.md) — provider setup, status & privacy invariants
- [`SECURITY.md`](SECURITY.md) — vulnerability disclosure

---

_FraudCase GH does not provide legal advice and is not affiliated with any government agency or law-enforcement authority._
