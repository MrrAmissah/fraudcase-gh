# FraudCase Quick Check — Phased Implementation Plan (TODO)

_**Status update (2026-06-24):** Phases 1–4 have been implemented and merged (public analyze,
save-as-private-case bridge, consented community signals, admin review dashboard). Remaining
production-hardening items from Phase 5 (App Check / CAPTCHA enforcement, clustering polish) are
tracked separately in issues #9 and #10. This file is retained as historical implementation
context, not as an active "not started" TODO list._

_Original framing (kept for context): a proposal where each phase is independently shippable and
leaves the app green. See `QUICK_CHECK_IMPLEMENTATION_AUDIT.md`._

## Guardrails (apply to every phase)
- Do **not** touch: private dashboard/case-detail/evidence-vault/report-preview layouts, Firebase
  Auth model, private-case ownership model, or `BrandLogo`. No Next.js. No unrelated features.
- Reuse, don't duplicate: `redactPIIAndSecrets`, `validateUploadedFile`, `analyzeFraudCase`, and the
  existing result-display components.
- Privacy invariants: server-side Gemini only (no client key); **no raw anonymous storage by
  default**; redaction **before** analysis and before any storage; HTML treated as escaped plain
  text (never DOM); admin data never visible to normal users.
- Language stays non-accusatory ("possible fraud indicators", "risk signal", "may suggest").

---

## Phase 1 — Public Quick Check: analyze only (no persistence)  · _lowest risk, start here_
**Goal:** a public visitor pastes/uploads evidence and gets a redacted AI risk signal. Nothing is
stored.

**Backend**
- `POST /api/quick-check/analyze` — **no auth**. Reuse `validateUploadedFile` with a **5MB** cap
  (new lower limit), run `redactPIIAndSecrets` on text / extracted readable-file bytes, call
  `analyzeFraudCase` on the **redacted** text only, return a `QuickCheckResult`. Hold uploads in
  memory; **persist nothing**.
- Basic abuse control: in-memory IP-based rate limiter + daily anonymous scan cap, with a clear
  "free scan limit reached" error. (No new dependency required; a small Map-based limiter is fine
  for MVP. App Check / CAPTCHA = documented TODO.)

**Types**
- `QuickCheckResult` (`src/types/quickCheck.ts`): `quickCheckId, scamCategory, riskScore,
  confidence, shortSummary, possibleFraudIndicators, extractedEntities, redactionWarnings,
  recommendedNextSteps, saveAsCaseAvailable, shareRedactedSignalAvailable, disclaimer`.

**Frontend**
- `QuickCheckPage` + `QuickCheckHero`, `QuickCheckInputPanel`, `QuickCheckUploadZone`.
- `QuickCheckResultCard` composed of `QuickCheckRiskSummary`, `QuickCheckExtractedEntities`
  (reuse `ExtractedEntitiesTable`), `QuickCheckIndicators` (reuse `SuspiciousIndicators`),
  `QuickCheckNextSteps`, and the required disclaimer.
- **Public routing:** add `quick_check` view state to `App.tsx` that renders **without** a signed-in
  user (today every non-landing view is auth-gated — this needs a deliberate public branch).
- Landing CTA "**Quick Check a Suspicious Message**" + supporting copy + privacy note (exact strings
  from the prompt).

**Done when:** public user analyzes text and a small file without signing in; redaction runs before
analysis; result renders safely; nothing is persisted; build/lint green.

---

## Phase 2 — Save as private case (auth bridge)
**Goal:** from a Quick Check result, "Create account to save as case" → after sign-in, seed a
private case preserving the redacted analysis.

- `CreateAccountCTA` → existing `AuthPage`; on auth success, call existing `createCase` (+ seed the
  redacted result/analysis). Reuse the private workspace for further evidence — no new private UI.
- Only authenticated, owner-scoped writes (unchanged ownership model). If the seeding is non-trivial,
  scaffold the CTA + a TODO but keep the UX path visible.

**Done when:** an anonymous result can be carried through sign-up into a private case the user owns.

---

## Phase 3 — Consent + community signals (redacted only)
**Goal:** opt-in sharing of a **redacted** signal for admin review.

- `POST /api/quick-check/submit-signal` — accepts **redacted analysis output only**; writes
  `communitySignals/{signalId}` via Admin SDK with: `source:"quick_check"`, `consentGiven:true`,
  `redactedText, scamCategory, riskScore, confidence, possibleFraudIndicators, extractedEntities,
  normalizedDomain, normalizedSender, maskedPhone/partialPhoneHash, amountRequested,
  countryContext:"GH", createdAt, reviewedStatus:"pending", clusterId?, userId?|null,
  rawFileStored:false`. **No raw file, no unredacted text.**
- `ShareRedactedSignalConsent` component with the exact consent copy; options "Analyze only / Share
  redacted signal / Create private case".
- **Firestore rules:** `communitySignals` is **default-deny** to clients (server/Admin-mediated
  only). Add to `firestore.rules`.
- Redaction tuning: add investigative-value email masking (`u***@email.com`) and/or a high-privacy
  mode, since signals are shared.

**Done when:** consented signals land in `communitySignals` with `rawFileStored:false` and are
unreadable by normal clients.

---

## Phase 4 — Admin community-signals dashboard
**Goal:** admin-only review queue. Invisible to normal users.

- Admin auth: `ADMIN_EMAILS` env allowlist + `requireAdmin` middleware (verify ID token, check email
  ∈ allowlist). Document clearly as interim until a real role system exists.
- Routes: list signals, mark `reviewed` / `false_positive` / `useful pattern`.
- `AdminSignalsPage` + `AdminSignalTable` (date, scam category, risk, confidence, masked
  sender/domain, top indicator, status), `AdminSignalDetailDrawer`, `SignalClusterCard`
  (repeated domains/senders, high-risk clusters). UI label: "Community Fraud Signals" /
  "Fraud Pattern Library" — never "AI memory".
- **Server-side admin guard on every admin route** (not just hidden UI).

**Done when:** only allowlisted admins can read/mutate signals; normal users get 403 and see no
admin UI.

---

## Phase 5 — Abuse hardening & clustering polish
- App Check / CAPTCHA integration (replace the in-memory limiter TODO).
- Signal clustering: `normalizedDomain` / `normalizedSender` grouping, `partialPhoneHash`.
- Optional high-privacy redaction mode surfaced in the UI.

---

## Cross-cutting acceptance checklist (final)
- [ ] Public user can open & use Quick Check without signing in.
- [ ] Redaction runs before analysis; only redacted text reaches Gemini/heuristic.
- [ ] Anonymous raw evidence is **not** stored by default.
- [ ] 5MB cap + allowlist + magic-byte validation on Quick Check uploads; blocked types rejected.
- [ ] HTML handled as escaped plain text (never rendered as DOM).
- [ ] Consent flow stores redacted signals only, `rawFileStored:false`.
- [ ] `communitySignals` not readable by normal users; admin routes server-guarded.
- [ ] Rate-limit / abuse scaffold present with a clear over-limit error.
- [ ] All copy non-accusatory; required disclaimer present on results.
- [ ] No client-side Gemini key; analysis stays server-side.
- [ ] Private dashboard, Auth, ownership model, and `BrandLogo` untouched.
- [ ] `npm run lint` and `npm run build` pass.
