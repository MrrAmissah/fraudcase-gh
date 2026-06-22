# Threat Intelligence Enrichment and Fraud Alerts Plan

**Status:** Plan only (not implemented)  
**Parent:** [`PRODUCTION_PLAN.md`](./PRODUCTION_PLAN.md)  
**Related:** [`AGENT_PLAYBOOK.md`](./AGENT_PLAYBOOK.md), [`PRODUCTION_DEFINITION_OF_DONE.md`](./PRODUCTION_DEFINITION_OF_DONE.md)

This document captures the technical design for adding external/internal reputation enrichment and curated fraud alerts to FraudCase GH. It is a roadmap. No providers are implemented yet.

Language rules for this feature (non-negotiable): use **external reputation signal**, **possible match**, **flagged by source**, **needs verification**, **not confirmed fraud**. Never use **confirmed scam**, **confirmed fraud**, or **scammer database**.

---

## 1. Product purpose

FraudCase GH should not rely only on AI text interpretation. AI reads language; it does not know whether a domain is already known-bad or whether a pattern matches an active local alert. The product should:

- Extract concrete indicators from (redacted) evidence: URLs, domains, phone numbers, emails, wallet handles, shortcodes.
- Check those indicators against internal caches, internal Ghana/community/admin alerts, and (opt-in, server-side) external reputation sources.
- Cache results to control cost and latency.
- Pass **structured reputation signals** into the analysis pipeline as grounded inputs, clearly separated from AI interpretation.

The output frames everything as a **possible match / external reputation signal that needs verification**, never as a confirmation of fraud or an accusation of a person.

---

## 2. High-level flow

```
Evidence submitted
  -> parse / redact text
  -> extract indicators
  -> normalize URLs / domains
  -> de-duplicate
  -> check internal cache
  -> check internal Ghana / community / admin alerts
  -> check low-cost external reputation provider (Tier 2)
  -> check deeper provider only when needed (Tier 3)
  -> compute reputation summary
  -> pass structured summary into Gemini / heuristic analysis
  -> show separate sections in the UI:
       - Evidence found in user submission
       - External reputation signals
       - AI interpretation
       - Recommended safety steps
```

External lookups are opt-in and disabled by default. If no URL/domain is extracted, no external provider is called.

---

## 3. Proposed module structure

Future layout (not created yet):

```
src/lib/threat-intel/
  types.ts
  extractIndicators.ts
  normalizeUrl.ts
  normalizeDomain.ts
  reputationCache.ts
  threatIntelService.ts
  threatIntelScoring.ts
  providers/
    safeBrowsingProvider.ts
    virusTotalProvider.ts
    internalSignalsProvider.ts
    adminAlertsProvider.ts
    localHeuristicsProvider.ts
  __tests__/
    extractIndicators.test.ts
    normalizeUrl.test.ts
    threatIntelScoring.test.ts
    reputationCache.test.ts
```

---

## 4. Core types

TypeScript-style pseudo-types (final shapes decided at implementation time):

```typescript
type IndicatorType = "url" | "domain" | "phone" | "email" | "wallet" | "shortcode";
type PrivacyClass = "public" | "sensitive" | "do_not_send_external";

interface ExtractedIndicator {
  type: IndicatorType;
  rawValue: string;
  normalizedValue: string;
  sourceEvidenceId?: string;
  sourceSpan?: { start: number; end: number };
  confidence: number;        // 0..1 extraction confidence
  privacyClass: PrivacyClass;
}

interface UrlIndicator extends ExtractedIndicator { type: "url"; domain: string; hasTrackingParams: boolean; }
interface DomainIndicator extends ExtractedIndicator { type: "domain"; isPunycode: boolean; tld: string; }
interface PhoneIndicator extends ExtractedIndicator { type: "phone"; country?: string; masked: boolean; }

type ReputationProviderName =
  | "local_heuristics" | "internal_signals" | "admin_alerts" | "safe_browsing" | "virustotal" | "misp";

interface ThreatIntelSourceRef {
  provider: ReputationProviderName;
  reference?: string;        // opaque id / url to the source record (no secrets)
  retrievedAt: string;
}

interface ProviderVerdict {
  provider: ReputationProviderName;
  checkedAt: string;
  status: "match" | "no_match" | "unknown" | "error" | "rate_limited";
  category: "phishing" | "malware" | "social_engineering" | "suspicious" | "benign" | "unknown";
  confidence: number;        // 0..1
  rawScoreSummary?: string;  // short, non-sensitive summary; never raw evidence
  sourceRef: ThreatIntelSourceRef;
  cacheTtlSeconds: number;
}

interface ThreatIntelSignal {
  indicator: ExtractedIndicator;
  verdicts: ProviderVerdict[];
  aggregateStatus: "possible_match" | "no_match_found" | "needs_verification" | "unknown";
}

interface FraudAlertMatch {
  alertId: string;
  matchedIndicators: string[];
  matchStrength: "weak" | "moderate" | "strong";
}

interface ThreatIntelEnrichmentResult {
  indicators: ExtractedIndicator[];
  providerSignals: ThreatIntelSignal[];
  internalMatches: ThreatIntelSignal[];
  adminAlertMatches: FraudAlertMatch[];
  riskContribution: number;      // bounded contribution to the overall risk model
  userFacingSummary: string;     // non-accusatory
  analysisNotesForModel: string; // structured notes the model MAY reference (never invent)
  privacyWarnings: string[];
}

type FraudAlertStatus = "draft" | "published" | "retired";

interface FraudAlert {
  id: string;
  title: string;
  slug: string;
  summary: string;
  patternType: string;           // e.g. "fake_delivery", "momo_reversal"
  affectedBrands: string[];
  countries: string[];
  indicators: ExtractedIndicator[];
  sourceLinks: string[];
  severity: "low" | "caution" | "elevated" | "high" | "critical";
  confidence: number;
  status: FraudAlertStatus;
  validFrom?: string;
  validTo?: string;
  createdBy: string;
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## 5. Provider strategy (tiers)

**Tier 0 — local heuristics** (no network): URL shorteners; lookalike domains; punycode/homograph; suspicious TLDs; brand mismatch; urgent-payment keywords near a URL; non-official domain claiming to be Ghana Post, a bank, a telco, or a delivery company.

**Tier 1 — cache / internal**: prior redacted community signals; admin-approved fraud alerts; locally cached previous provider lookups; a known-legitimate-domain allowlist.

**Tier 2 — Google Safe Browsing**: fast malware/social-engineering URL match; batch multiple URLs when possible; cache both no-match and match per policy; **a no-match is "not found in this source", never "safe"**.

**Tier 3 — VirusTotal**: deeper enrichment for URLs/domains/IPs; used only when needed (high-risk cases, private case review, admin review, or explicit user request for a deeper check); avoid submitting private/sensitive URLs without policy/consent; cache aggressively; never expose the API key client-side; **one vendor flag is not proof**.

**Tier 4 — future MISP / trusted feeds**: admin-curated feeds; possible Ghana/Africa threat-intel ingestion; strict source registry and approval workflow.

---

## 6. Privacy policy

- Never send full evidence bodies to URL reputation providers.
- Extract only URLs/domains/indicators.
- For private cases, default to internal/cache checks first.
- For third-party lookups, require consent or clear product disclosure.
- Do **not** submit private one-time links, password-reset links, signed URLs, tracking URLs with tokens, or any evidence URL containing personal tokens (`privacyClass: "do_not_send_external"`).
- Strip tracking parameters where safe.
- Store provider results, not raw sensitive evidence.
- Cache using the normalized URL/domain and/or an HMAC-hashed key where appropriate.
- Never expose provider API keys to the frontend.

---

## 7. Cost and quota design

- Cache-first lookup.
- Provider timeout budget (per provider).
- Provider circuit breaker on repeated failures.
- Daily quota guard per provider.
- Per-user / per-IP threat-intel lookup limit (reuse the shared rate limiter).
- Background refresh for admin alerts only.
- No provider call when no URL/domain was extracted.
- Safe Browsing before VirusTotal.
- VirusTotal only for higher-value checks.
- External lookups disabled by default.

Suggested env flags (all default off/safe):

```
THREAT_INTEL_ENABLED=false
SAFE_BROWSING_ENABLED=false
SAFE_BROWSING_API_KEY
VIRUSTOTAL_ENABLED=false
VIRUSTOTAL_API_KEY
THREAT_INTEL_EXTERNAL_LOOKUPS=false
THREAT_INTEL_CACHE_TTL_HOURS
THREAT_INTEL_PROVIDER_TIMEOUT_MS
```

---

## 8. Scoring model

- An external provider match **increases risk but does not confirm fraud**.
- A no-match does **not** mean safe.
- An internal admin-alert match is strong pattern evidence.
- Multiple independent provider matches increase confidence.
- Recency matters; stale verdicts decay.
- Source reliability matters (weight per source).
- Provider disagreement is **shown as disagreement**, not hidden.
- Output separates: source-grounded signals, heuristic signals, and model interpretation.

Risk labels (all non-accusatory): **Low**, **Caution**, **Elevated**, **High**, **Critical**.

---

## 9. UI design

**Public Quick Check**: "External reputation signals"; "Known alert match"; "No external match found" (with a clear note that this does not mean safe); "Why this was flagged"; "What to do next".

**Private Case Workspace**: indicator table; provider-signal chips; evidence-source mapping; a "refresh reputation" button; admin-only source details.

**Fraud Alerts Portal**: public alerts page; filter by category (delivery, MoMo, bank, job/task scam, impersonation, fake investment); each alert shows summary, indicators, source references, and user safety steps; **no public naming of accused people/phone numbers unless from an official source and legally safe**.

**Admin**: create/edit/publish/retire alerts; approve community-signal patterns; link an alert to provider signals; audit log for all alert changes.

---

## 10. Ghana-specific source registry

A source registry (to research and vet before use), examples:

- Cyber Security Authority Ghana public alerts
- Bank of Ghana notices
- Ghana Post official scam notices
- Telco official fraud warnings (MTN, Telecel, AT)
- Official police / cybercrime notices
- Trusted CERT/CSIRT feeds
- Trusted international threat feeds

Do not scrape unofficial blogs as authoritative sources. Do not publish unverified accusations.

---

## 11. Integration into the analysis prompt/schema

- Add `externalReputationSignals` to the Gemini analysis **input** (supplied by the backend only).
- Gemini may reference provider signals only when supplied; it must **not invent** provider results.
- Gemini must distinguish: "the URL was flagged by an external source" vs "the message content looks suspicious" vs "the case resembles an active alert".
- Output schema additions: `externalSignals`, `matchedAlerts`, `indicatorFindings`, `confidenceReasons`, `limitations`.

---

## 12. Implementation roadmap (small commits)

1. `feat: add indicator extraction and URL normalization`
2. `feat: add threat intel types and cache interface`
3. `feat: add internal signals provider`
4. `feat: add Safe Browsing provider behind env flag`
5. `feat: add threat intel scoring summary`
6. `feat: pass reputation signals into analysis prompt`
7. `feat: show external reputation signals in Quick Check UI`
8. `feat: add admin fraud alerts model`
9. `feat: add public Fraud Alerts portal`
10. `feat: add VirusTotal provider behind env flag and consent policy`

---

## 13. Definition of done

- No provider API key in the frontend.
- External lookup disabled by default.
- Tests for URL extraction/normalization.
- Tests for provider no-match / match / error / rate-limited.
- Cache behavior tested.
- No-match language is safe ("not found in this source", not "safe").
- No "confirmed fraud" wording anywhere.
- Provider failures do not break analysis (graceful degradation to internal/heuristic).
- Source references are visible.
- Privacy risks documented.
- Admin alerts are reviewed before publication.

---

_Last updated: 2026-06-22_
