# FraudCase GH — Portfolio Case Study

> A full-stack, AI-assisted, privacy-first tool for organizing digital-scam evidence in the Ghanaian context. This document explains the *why* and the *how* behind the build — the product thinking, the engineering decisions, and the trade-offs.

---

## Why I built it

Digital scams are a daily reality for people I know in Ghana. The patterns are familiar: a text from a spoofed `GH-POST` sender demanding a small "clearance fee" for a parcel; a Mobile Money message claiming a transfer was sent "by mistake" and asking for it back; a WhatsApp recruiter offering easy money for liking videos — after a deposit.

When someone is targeted, the experience is chaotic. Evidence is scattered across screenshots and chat threads, it is unclear how serious the threat is, and the instinct to "expose" the scammer publicly can backfire — defaming innocent people and leaking the victim's own sensitive data in the process.

I wanted to build something that does the unglamorous-but-useful thing: **help a person calmly organize what happened, understand the risk, and produce a clean report they can actually act on** — without turning it into a vigilante platform. It is also a deliberate demonstration of the skills I care about: full-stack engineering, applied LLM integration done responsibly, and security/privacy as a first-class concern rather than an afterthought.

---

## Ghana / context relevance

The product is grounded in scam patterns that are specific and recognizable locally:

- **Fake delivery / clearance-fee smishing** using masked sender IDs (`GH-POST`, `Ghana-Revenue`, courier brands) and unofficial domains.
- **Mobile Money fraud** — "wrong transfer" reversal tricks and fake MoMo confirmation messages mimicking MTN MoMo, Telecel Cash, and AT Money formats.
- **Task/recruitment fraud** on WhatsApp/Telegram demanding deposits to "unlock" earnings.
- **Credential phishing** via account-suspension scares.

The app speaks this language: it knows about NCA reporting (shortcode **292**), the major mobile-money operators, and locally sensitive identifiers like the **Ghana Card**, which the redaction layer detects and masks. The goal is relevance without stereotyping — patterns are described as *possible indicators*, never as accusations.

---

## Product thinking

- **Two front doors, by design.** A public **Quick Check** (no sign-up, nothing stored) removes all friction for someone who just wants a fast read on a single message. A **private workspace** serves people building a real case over time. The Quick Check can convert into a saved case once a user signs in — a natural, low-pressure funnel.
- **Harm-reduction framing.** The hardest product decision was tone. A "fraud detector" can easily become a shaming machine. I chose consistently non-accusatory language, a visible disclaimer, and **no public directory of people or cases**.
- **Consent over collection.** Community signals (which help spot recurring patterns) are **opt-in and redacted**. The default is to keep everything private and ephemeral; contributing is an explicit, explained choice.
- **Trust through transparency.** The UI tells users when sensitive data was masked before analysis, and the report is explicit about being decision-support, not a verdict.

---

## Technical decisions

- **Single full-stack Express service.** One server hosts both the API and the React/Vite client (Vite middleware in dev; static build + bundled server in prod). This keeps the project simple to run and deploy for a portfolio context, with one obvious entry point (`server.ts`).
- **Firebase for managed primitives.** Auth, Firestore, and Cloud Storage remove a lot of undifferentiated heavy lifting and let me focus on the domain logic and the security model on top of them.
- **ADC over service-account keys.** The target Google Cloud project blocks service-account key creation by organization policy. Rather than fight that, the Admin SDK uses **Application Default Credentials** (`gcloud auth application-default login`). The code passes no explicit credential, so `firebase-admin` resolves ADC automatically — and the env-check script detects local ADC so setup is verifiable.
- **Structured LLM output with a resilient fallback.** Gemini is called with a `responseSchema` so it returns typed JSON matching the app's `FraudAnalysis` shape. If no key is configured or the model errors, a **deterministic heuristic** produces the same structure — the app degrades gracefully instead of breaking. The real Gemini/model error is always logged in development (never silently swallowed).
- **Zero-dependency tests.** Analysis-quality tests use Node's built-in `node:test` runner executed through the `tsx` loader already in the toolchain — no extra test framework to maintain.

---

## Security decisions

- **Redact before the model sees anything.** PII and secrets (Ghana Card, email, phone, card/bank numbers, API keys, PIN/OTP) are masked *before* text is sent to Gemini, and raw input is never persisted for the public Quick Check.
- **Server-enforced ownership.** Authorization does not trust the client. Every protected route verifies a Firebase ID token, derives `ownerId` from the token, and re-checks ownership on each case-scoped operation. `ownerId` is never accepted from request bodies, and updates are field-whitelisted.
- **Ephemeral by default.** Quick Check writes nothing; community signals store only redacted/derived data and never raw input or files.
- **Fail-closed admin.** If the admin allowlist is empty, the admin surface is inaccessible to everyone — the safe default.
- **Per-user storage namespacing.** Uploaded files live under `users/{uid}/cases/{caseId}/…`, and downloads re-verify ownership.

These are described in depth, with code references, in [`SECURITY_PRIVACY_OVERVIEW.md`](SECURITY_PRIVACY_OVERVIEW.md).

---

## AI safety decisions

- **Non-accusatory by construction.** The system instruction and prompt forbid guilt/criminality language; every output includes a disclaimer that it is not legal advice or a law-enforcement determination.
- **Grounding over fabrication.** Extracted entities must come from the evidence; absent values stay empty rather than being guessed. This was a concrete fix: an earlier heuristic fabricated placeholder names, locations, domains, and amounts — that behavior was removed and locked down with regression tests.
- **Risk is guidance, not judgment.** The score drives recommended next steps; it is never presented as a verdict on a person.

---

## What I learned

- **LLM output is only as trustworthy as its grounding.** Plausible-but-invented entities (a fake "Sarah", a made-up `.cz` domain) are worse than empty fields in a tool people might act on. Enforcing "evidence-only, empty when absent" — in both the prompt and the fallback — materially improved trustworthiness.
- **Subtle wiring bugs can silently disable a whole feature.** Reading `GEMINI_API_KEY` at module-load time meant the key was captured *before* `dotenv` populated the environment, so Gemini was silently bypassed and the heuristic ran every time. Moving the read to call time fixed it. The lesson: verify *which path actually executed*, don't assume from configuration.
- **Overall risk vs. per-component severity are different things.** A case correctly scored "Critical" overall still showed every indicator badge as "Low" because a UI component re-derived severity from keywords and defaulted to the safest-sounding label. Defaults in risk surfaces should never understate risk.
- **Cloud auth under org policy.** When key creation is blocked, ADC is the right tool — and designing setup tooling (`check:env`) to detect it makes the constraint manageable instead of a blocker.
- **Privacy design is a series of defaults.** Ephemeral-by-default, redact-before-AI, opt-in sharing, and fail-closed admin are each small decisions that compound into a coherent privacy posture.

---

## Future improvements

- Firestore & Cloud Storage **security rules** as defense-in-depth alongside the server checks.
- **Signed URLs** for time-limited file access.
- Richer, multi-language entity extraction for local phrasing (Twi/Pidgin).
- **Collaboration**: scoped sharing of a case with a bank or responder.
- Optional **reporting integrations** (e.g. NCA 292).
- **CI** running lint, build, and an automated end-to-end suite.

---

_FraudCase GH is an educational/portfolio project. It does not provide legal advice and is not affiliated with any government agency or law-enforcement authority._
