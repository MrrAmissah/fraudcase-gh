# FraudCase Quick Check — Implementation Audit

_Audit date: 2026-06-19 · Method: full-codebase keyword sweep + route/collection inspection.
No feature code was written (major parts missing → see `QUICK_CHECK_TODO.md` for the phased plan)._

## Verdict: ❌ NOT IMPLEMENTED (0%)

FraudCase **Quick Check has not been started.** A whole-repo sweep for `quick`, `quickcheck`,
`quick-check`, `communitySignal`, `signal`, `admin`, `ADMIN_EMAIL`, `rate-limit`, `consent`,
`share-redacted` found **no Quick Check artifacts**:
- The only `admin` source file is `src/lib/firebase/admin.ts` (the Firebase Admin SDK setup).
- Every `signal` hit is incidental copy in existing analysis ("risk signals") or the `signal-exit`
  npm package.
- The only Firestore collection referenced anywhere in `server.ts` is `cases`.

**Important:** this is a clean "not yet built" — it is **not** broken or half-wired. The existing
private workspace is fully intact, and `npm run lint` + `npm run build` both pass (exit 0).

---

## 1. Required artifacts — presence check

### Pages
| Required | Status |
|----------|--------|
| `QuickCheckPage` | ❌ Missing |
| `QuickCheckResultPage` | ❌ Missing |
| `AdminSignalsPage` / `AdminCommunitySignalsPage` | ❌ Missing |

### Components
| Required | Status |
|----------|--------|
| `QuickCheckHero` | ❌ Missing |
| `QuickCheckInputPanel` | ❌ Missing |
| `QuickCheckUploadZone` | ❌ Missing |
| `QuickCheckResultCard` | ❌ Missing |
| `QuickCheckRiskSummary` | ❌ Missing |
| `QuickCheckExtractedEntities` | ❌ Missing (note: `ExtractedEntitiesTable` exists and is reusable) |
| `QuickCheckIndicators` | ❌ Missing (note: `SuspiciousIndicators` exists and is reusable) |
| `QuickCheckNextSteps` | ❌ Missing |
| `ShareRedactedSignalConsent` | ❌ Missing |
| `CreateAccountCTA` | ❌ Missing |
| `AdminSignalTable` | ❌ Missing |
| `AdminSignalDetailDrawer` | ❌ Missing |
| `SignalClusterCard` | ❌ Missing |

### API routes
| Required | Status |
|----------|--------|
| `POST /api/quick-check/analyze` (public, rate-limited) | ❌ Missing |
| `POST /api/quick-check/submit-signal` (consent) | ❌ Missing |
| Admin signals route(s) | ❌ Missing |

### Data model / collections
| Required | Status |
|----------|--------|
| `communitySignals/{signalId}` collection | ❌ Missing (only `cases` exists) |
| `QuickCheckResult` type | ❌ Missing |
| Community-signal Firestore rules | ❌ Missing |

### Landing integration
| Required | Status |
|----------|--------|
| "Quick Check a Suspicious Message" CTA on landing | ❌ Missing |
| Supporting copy + privacy note | ❌ Missing |

### Abuse / privacy controls
| Required | Status |
|----------|--------|
| Rate limiting (IP/device, daily anon cap) | ❌ Missing — no rate-limit dependency or scaffold |
| 5MB Quick Check file cap (lower than private 10MB) | ❌ Missing |
| File-type allowlist for Quick Check | ⚠️ Reusable: `validateUploadedFile` exists (10MB cap, same allowlist) |
| App Check / CAPTCHA | ❌ Missing (TODO acceptable per prompt) |
| `ADMIN_EMAILS` allowlist / admin guard | ❌ Missing |

---

## 2. Categorized findings

### Fully implemented
- **None** of Quick Check.

### Partially implemented (reusable building blocks already in the codebase)
These are **not** Quick Check, but Quick Check should be built **on top of** them rather than
duplicating logic:
- **Redaction guard** — `src/lib/security/redaction.ts` (`redactPIIAndSecrets`) masks phone, email,
  card/wallet, bank account, Ghana Card, API keys/secrets, OTP/PIN.
- **File validation** — `src/lib/security/fileValidation.ts` (`validateUploadedFile`): extension +
  MIME + magic-byte allowlist matching Quick Check's exact allowed/blocked type lists.
- **AI analysis** — `src/lib/gemini/analyzeFraudCase.ts`: server-side Gemini with heuristic
  fallback, already prioritizes `redactedText`. Its output (scamCategory, riskScore, confidence,
  shortSummary, suspiciousIndicators, extractedEntities, recommendedNextSteps, disclaimer) maps
  almost 1:1 onto the required `QuickCheckResult`.
- **Result-display components** — `ExtractedEntitiesTable`, `SuspiciousIndicators`, `RiskScoreCard`,
  `AnalysisSummary` are reusable for the Quick Check result.
- **Brand/layout** — `BrandLogo`, `AppShell`, light forensic theme available for reuse.

### Missing
- Everything listed in §1 (all pages, components, both public routes, the admin surface, the
  `communitySignals` model + rules, rate limiting, landing CTA).

### Implemented but unsafe
- **None** (nothing to be unsafe yet). The general security posture Quick Check must preserve —
  server-side-only Gemini (no client key), authenticated downloads, no raw HTML DOM rendering — is
  already in place in the private workflow and must be carried into Quick Check.

### Implemented but visually inconsistent
- **N/A** — nothing built.

---

## 3. Gap analysis (for when the feature is built)

### Security / privacy gaps
- **No rate limiting / abuse control** anywhere — required for a public, unauthenticated endpoint.
- **No `communitySignals` access rules** — when added, the collection must be **default-deny to
  clients** and admin-read-only (Admin SDK mediated), or normal users could read signals.
- **No admin authorization mechanism** — no role system and no `ADMIN_EMAILS` allowlist exist.
- The "no raw anonymous storage by default" guarantee must be designed in from the first route;
  the `/analyze` endpoint must hold uploads in memory only and never persist.

### Redaction / storage gaps
- **Email masking is too aggressive for Quick Check's spec.** Current behavior fully replaces emails
  with `[EMAIL-REDACTED]`; the prompt asks for investigative-value masking like `u***@email.com`.
  Phone masking already matches the spec (`024***4567`). A masking-style adjustment (or a
  high-privacy toggle) is needed for the community-signal use case.
- **No `communitySignals` write path** — `submit-signal` must accept **redacted output only** and
  set `rawFileStored: false`.
- Quick Check should reuse `validateUploadedFile` but with a **5MB** cap (vs the private 10MB).

### Backend / API gaps
- Both public routes missing. `App.tsx` is a manual view-state router (no React Router) and
  currently **gates every non-landing view behind authentication** — Quick Check needs a genuinely
  **public** view path that renders without a signed-in `user`.

### UX / copy gaps
- No landing CTA, no Quick Check input/result UI, no consent copy, no save-as-case CTA.
- Required exact copy (consent text, privacy note, disclaimers) is not present anywhere.

### Admin access gaps
- No admin page, no admin route, no admin guard. Must be invisible to normal users.

---

## 4. Test results
| Check | Result |
|-------|--------|
| `npm run lint` (`tsc --noEmit`) | ✅ exit 0 |
| `npm run build` (vite + esbuild) | ✅ exit 0 |
| Existing private workspace intact | ✅ untouched by this audit; routes/collections unchanged |
| Server boots, unauth `/api/*` → 401 | ✅ (verified in prior phase) |

> Note: build/lint are green **including** the uncommitted evidence-upload-hardening work on
> branch `fix/evidence-upload-hardening`. No Quick Check code was added.

---

## 5. Acceptance-criteria reality check
Every Quick Check acceptance criterion (public analyze without sign-in, redaction-before-analysis,
opt-in signal sharing, admin review queue, no-raw-storage-by-default, admin isolation, rate-limit
scaffold, non-accusatory language) is currently **unmet because the feature does not exist** — not
because anything is broken. The non-accusatory language requirement is already satisfied in the
existing analysis layer (`fraudCasePrompt.ts` + disclaimers), so Quick Check inherits it for free if
built on `analyzeFraudCase`.

---

## 6. Recommended next action
**Do not build Quick Check in a single pass.** It spans a public endpoint, abuse controls, a new
data model, a consent flow, an auth bridge, and an admin surface — each with its own privacy
implications. Follow the **phased plan in [`QUICK_CHECK_TODO.md`](./QUICK_CHECK_TODO.md)**, starting
with Phase 1 (public analyze, no persistence) which is low-risk and reuses existing redaction +
analysis. Get explicit approval on the plan before implementation.
