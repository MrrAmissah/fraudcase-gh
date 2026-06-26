/**
 * Threat-intelligence enrichment types (see docs/THREAT_INTEL_ENRICHMENT_PLAN.md).
 *
 * Non-negotiable wording: external lookups produce "external reputation signals" / "possible match" /
 * "needs verification" — never "confirmed fraud/scam" and never an accusation of a person. A no-match
 * means "not found in this source", never "safe".
 */

export type IndicatorType = "url" | "domain" | "phone" | "email" | "wallet" | "shortcode";

/**
 * Whether an indicator may be sent to an EXTERNAL reputation provider.
 * - `do_not_send_external`: contains tokens/secrets/personal one-time data; internal/local checks only.
 */
export type PrivacyClass = "public" | "sensitive" | "do_not_send_external";

export interface ExtractedIndicator {
  type: IndicatorType;
  /** Already-redacted/safe display value (raw PII is never carried here). */
  value: string;
  /** Normalized key used for caching/matching (lowercased host, etc.). */
  normalizedValue: string;
  sourceEvidenceId?: string;
  confidence: number; // 0..1 extraction confidence
  privacyClass: PrivacyClass;
  /** For url/domain indicators. */
  domain?: string;
  tld?: string;
}

export type ReputationProviderName =
  | "local_heuristics"
  | "internal_signals"
  | "admin_alerts"
  | "safe_browsing"
  | "virustotal";

export type VerdictStatus = "match" | "no_match" | "unknown" | "error" | "rate_limited";
export type VerdictCategory =
  | "phishing"
  | "malware"
  | "social_engineering"
  | "suspicious"
  | "benign"
  | "unknown";

export interface ProviderVerdict {
  provider: ReputationProviderName;
  checkedAt: string;
  status: VerdictStatus;
  category: VerdictCategory;
  confidence: number; // 0..1
  /** Short, non-sensitive summary of WHY (never raw evidence). */
  rawScoreSummary?: string;
  /** Opaque, non-secret reference to the source record. */
  reference?: string;
  cacheTtlSeconds: number;
}

export type AggregateStatus = "possible_match" | "no_match_found" | "needs_verification" | "unknown";

export interface ThreatIntelSignal {
  indicator: ExtractedIndicator;
  verdicts: ProviderVerdict[];
  aggregateStatus: AggregateStatus;
}

export type ThreatRiskLabel = "low" | "caution" | "elevated" | "high" | "critical";

export interface ThreatIntelEnrichmentResult {
  indicators: ExtractedIndicator[];
  signals: ThreatIntelSignal[];
  riskLabel: ThreatRiskLabel;
  /** Bounded 0..1 contribution to the overall risk model (never a confirmation). */
  riskContribution: number;
  /** Non-accusatory text for users. */
  userFacingSummary: string;
  /** Structured notes the analysis model MAY reference but must never invent. */
  analysisNotesForModel: string;
  privacyWarnings: string[];
}

/** Approved, non-accusatory phrasing. Tier-0 results are LOCAL indicators, never "external checks". */
export const THREAT_INTEL_WORDING = {
  panelTitle: "Risk signals",
  localIndicator: "Local indicator",
  externalReputation: "External reputation",
  possibleMatch: "Possible match",
  needsVerification: "Needs verification",
  providerMatch: "Provider reported a match",
  noLocalIndicators: "No local indicators detected",
  noExternalMatch: "No external match returned",
  notChecked: "Not checked",
  unavailable: "Unavailable",
} as const;

/**
 * Phrases that must NEVER appear in threat-intel output. ("safe"/"clean" are also banned but checked
 * as whole words in tests to avoid matching "safety", so they aren't listed here as substrings.)
 */
export const FORBIDDEN_PHRASES: readonly string[] = [
  "confirmed fraud",
  "confirmed scam",
  "scammer",
  "criminal",
  "guilty",
];
