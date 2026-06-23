/**
 * Deterministic grounding/verification for extracted facts.
 *
 * IMPORTANT ordering: this runs on the RAW visible text in the same request, BEFORE redaction.
 * The `verification` result is computed here, then the raw text and full-normalized sensitive
 * values are discarded. Persistence keeps only the redacted value plus this verification outcome.
 * That is why a fact can read `exact_match` while only its masked value is stored.
 */
import {
  HIGH_RISK_FACT_TYPES,
  type ExtractionValidation,
  type RawExtractedFact,
  type VerificationMatch,
  type VerificationStatus,
} from "./types";

export interface GradedFact extends RawExtractedFact {
  verification: VerificationMatch;
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
function digitsOnly(s: string): string {
  return s.replace(/\D+/g, "");
}
function normalizeAmount(s: string): string {
  return s.replace(/\s+/g, "").replace(/,/g, "").toUpperCase();
}
function normalizeUrlHost(s: string): string {
  try {
    return new URL(s).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return s.trim().toLowerCase();
  }
}

/** Classify how well a single fact is grounded in the raw source text. */
export function gradeFact(rawVisibleText: string, fact: RawExtractedFact): VerificationMatch {
  const source = normalizeWhitespace(rawVisibleText);
  const sourceLc = source.toLowerCase();
  const raw = (fact.rawValue || "").trim();
  if (!raw || !(fact.evidenceQuote || "").trim()) return "unsupported";

  // Literal verbatim appearance is the strongest signal.
  if (source.includes(raw) || sourceLc.includes(raw.toLowerCase())) return "exact_match";

  switch (fact.type) {
    case "phone_number": {
      const d = digitsOnly(raw);
      const sd = digitsOnly(source);
      if (d.length >= 7 && sd.includes(d)) return "normalized_match";
      // Handle +233 vs 0 prefix variants by matching the trailing local digits.
      if (d.length >= 9 && sd.includes(d.slice(-9))) return "normalized_match";
      if (d.length >= 6 && sd.includes(d.slice(-6))) return "weak_match";
      return "unsupported";
    }
    case "amount": {
      const a = normalizeAmount(raw);
      const sa = normalizeAmount(source);
      if (a.length >= 2 && sa.includes(a)) return "normalized_match";
      const num = a.replace(/[^0-9.]/g, "");
      if (num.length >= 2 && sa.includes(num)) return "weak_match";
      return "unsupported";
    }
    case "url": {
      const host = normalizeUrlHost(raw);
      if (host && sourceLc.includes(host)) return "normalized_match";
      return "unsupported";
    }
    case "transaction_ref": {
      const core = raw.replace(/[^a-z0-9]/gi, "").toLowerCase();
      const score = sourceLc.replace(/[^a-z0-9]/gi, "");
      if (core.length >= 4 && score.includes(core)) return "normalized_match";
      return "unsupported";
    }
    default: {
      // names, organizations, dates, times: case-insensitive substring or full token overlap.
      const core = raw.toLowerCase();
      if (sourceLc.includes(core)) return "exact_match";
      const tokens = core.split(/\s+/).filter((t) => t.length >= 2);
      if (tokens.length > 0 && tokens.every((t) => sourceLc.includes(t))) return "weak_match";
      return "unsupported";
    }
  }
}

/** Grade every fact against the raw source text. */
export function gradeFacts(rawVisibleText: string, facts: RawExtractedFact[]): GradedFact[] {
  return facts.map((f) => ({ ...f, verification: gradeFact(rawVisibleText, f) }));
}

/** Aggregate grounding into a validation summary, forcing human review on weak/high-risk cases. */
export function summarizeValidation(graded: GradedFact[]): ExtractionValidation {
  const total = graded.length;
  const verified = graded.filter(
    (f) => f.verification === "exact_match" || f.verification === "normalized_match",
  ).length;
  const groundingCoverage = total === 0 ? 1 : verified / total;

  const highRiskUnsupported = graded.some(
    (f) => f.verification === "unsupported" && HIGH_RISK_FACT_TYPES.has(f.type),
  );
  const hasWeak = graded.some((f) => f.verification === "weak_match");
  const hasUnsupported = graded.some((f) => f.verification === "unsupported");

  const requiresHumanReview = highRiskUnsupported || groundingCoverage < 0.7 || hasWeak || hasUnsupported;
  const reasons: string[] = [];
  if (highRiskUnsupported) reasons.push("unsupported high-risk entity");
  if (groundingCoverage < 0.7) reasons.push("low grounding coverage");
  if (hasWeak) reasons.push("weakly grounded entity");

  return {
    groundingCoverage,
    unsupportedClaims: [], // populated post-redaction so this stays redaction-safe
    highRiskUnsupported,
    requiresHumanReview,
    reviewReason: reasons.length ? reasons.join("; ") : undefined,
  };
}

/**
 * Initial (pre-user) verification status. No automatic-trust state exists: strong grounding only
 * yields a suggestion, never a trusted fact (Decision 2).
 */
export function initialVerificationStatus(verification: VerificationMatch): VerificationStatus {
  if (verification === "exact_match" || verification === "normalized_match") {
    return "high_confidence_suggested";
  }
  if (verification === "weak_match") return "suggested";
  return "needs_review"; // unsupported
}
