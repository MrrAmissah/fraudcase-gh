/**
 * Turns a raw, in-memory extraction into the persist-ready, REDACTED artifact.
 *
 * Privacy invariants enforced here:
 *  - `rawVisibleText` is never carried onto the output (the returned object has no such key).
 *  - Sensitive fact values are masked via `redactPIIAndSecrets`; their `rawValue` and full
 *    `normalizedValue` are never written.
 *  - Every `evidenceQuote`, visual-signal description, and uncertainty note is redacted.
 *  - The embedded text and facts are length/count capped to keep the case doc under 1 MiB.
 */
import { redactPIIAndSecrets } from "../security/redaction";
import { gradeFacts, summarizeValidation, initialVerificationStatus, type GradedFact } from "./groundExtraction";
import {
  EXTRACTION_SCHEMA_VERSION,
  MAX_EXTRACTED_FACTS,
  MAX_EXTRACTION_TEXT_CHARS,
  MAX_VISUAL_SIGNALS,
  SENSITIVE_FACT_TYPES,
  type ExtractedArtifact,
  type ExtractedFact,
  type ExtractionSourceType,
  type PrivacyFlags,
  type RawExtraction,
  type VerificationMatch,
  type VisualSignal,
} from "./types";

export interface ExtractionContext {
  evidenceId: string;
  ownerId: string;
  caseId: string;
  sourceType: ExtractionSourceType;
  extractionRunId: string;
  extractedAt: string;
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

/** Non-sensitive normalized value for display/comparison; undefined for sensitive types. */
function nonSensitiveNormalized(type: GradedFact["type"], rawValue: string): string | undefined {
  if (SENSITIVE_FACT_TYPES.has(type)) return undefined;
  if (type === "amount") return normalizeAmount(rawValue);
  if (type === "url") return normalizeUrlHost(rawValue);
  return undefined;
}

function confidenceFor(g: GradedFact): number {
  if (typeof g.confidence === "number" && g.confidence >= 0 && g.confidence <= 1) return g.confidence;
  const byMatch: Record<VerificationMatch, number> = {
    exact_match: 0.95,
    normalized_match: 0.85,
    weak_match: 0.5,
    unsupported: 0.2,
  };
  return byMatch[g.verification];
}

function buildFact(g: GradedFact, index: number, ctx: ExtractionContext): ExtractedFact {
  const sensitive = SENSITIVE_FACT_TYPES.has(g.type);
  const valueRedaction = redactPIIAndSecrets(g.rawValue || "");
  const quoteRedaction = redactPIIAndSecrets(g.evidenceQuote || "");

  const privacyFlags: PrivacyFlags = {
    containedSensitiveTypes: valueRedaction.detectedSensitiveTypes,
    redactionApplied: true,
    rawTextPersisted: false,
  };

  return {
    id: `xf-${ctx.extractionRunId}-${index}`,
    artifactId: ctx.extractionRunId,
    evidenceId: ctx.evidenceId,
    caseId: ctx.caseId,
    ownerId: ctx.ownerId,
    type: g.type,
    // Sensitive: only the masked value. Non-sensitive: redacted (usually unchanged) value.
    redactedValue: valueRedaction.redactedText,
    normalizedValue: sensitive ? undefined : nonSensitiveNormalized(g.type, g.rawValue || ""),
    evidenceQuote: quoteRedaction.redactedText,
    sourcePage: g.sourcePage,
    sourceRegion: null, // deferred until Cloud Vision / Document AI
    confidence: confidenceFor(g),
    verification: g.verification,
    verificationStatus: initialVerificationStatus(g.verification),
    verifiedByUser: false,
    extractedAt: ctx.extractedAt,
    privacyFlags,
  };
}

function redactSignal(s: VisualSignal): VisualSignal {
  return {
    signalType: s.signalType,
    description: redactPIIAndSecrets(s.description || "").redactedText,
    severity: s.severity,
    evidenceQuote: s.evidenceQuote ? redactPIIAndSecrets(s.evidenceQuote).redactedText : undefined,
    sourcePage: s.sourcePage,
  };
}

/**
 * Build the persist-ready, redacted artifact. The input `raw.rawVisibleText` is read here for
 * grounding and redaction, then NOT copied onto the output.
 */
export function buildPersistedArtifact(raw: RawExtraction, ctx: ExtractionContext): ExtractedArtifact {
  const cappedFacts = (raw.facts || []).slice(0, MAX_EXTRACTED_FACTS);
  const graded = gradeFacts(raw.rawVisibleText || "", cappedFacts);
  const validation = summarizeValidation(graded);

  const facts = graded.map((g, i) => buildFact(g, i, ctx));
  const visualSignals = (raw.visualSignals || []).slice(0, MAX_VISUAL_SIGNALS).map(redactSignal);
  const uncertaintyNotes = (raw.uncertaintyNotes || []).map(
    (n) => redactPIIAndSecrets(n || "").redactedText,
  );

  const textRedaction = redactPIIAndSecrets(raw.rawVisibleText || "");
  const redactedText = textRedaction.redactedText.slice(0, MAX_EXTRACTION_TEXT_CHARS);

  const sensitiveTypes = new Set<string>(textRedaction.detectedSensitiveTypes);
  for (const f of facts) {
    for (const t of f.privacyFlags.containedSensitiveTypes) sensitiveTypes.add(t);
  }

  return {
    schemaVersion: EXTRACTION_SCHEMA_VERSION,
    evidenceId: ctx.evidenceId,
    ownerId: ctx.ownerId,
    caseId: ctx.caseId,
    sourceType: ctx.sourceType,
    provider: raw.provider,
    extractionRunId: ctx.extractionRunId,
    redactedText,
    languageHint: raw.languageHint,
    facts,
    visualSignals,
    uncertaintyNotes,
    validation,
    extractionStatus: "extracted",
    redactionStatus: "applied",
    requiresHumanReview: validation.requiresHumanReview,
    extractedAt: ctx.extractedAt,
    privacyFlags: {
      containedSensitiveTypes: Array.from(sensitiveTypes),
      redactionApplied: true,
      rawTextPersisted: false,
    },
  };
}
