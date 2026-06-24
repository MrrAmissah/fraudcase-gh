/**
 * Type contracts for the private multimodal evidence pipeline (Sprint 3).
 *
 * Privacy invariants encoded here (see docs/SPRINT_3_PLAN.md):
 *  - Raw model output (`RawExtraction`) is request-memory only and is NEVER persisted.
 *  - Persisted shapes (`ExtractedArtifact`, `ExtractedFact`) carry redacted values only.
 *  - Sensitive fact values are masked; raw and full-normalized values are dropped.
 *  - A fact is trusted analysis input only after explicit user acceptance.
 */

export type ExtractionStatus = "none" | "queued" | "running" | "extracted" | "failed" | "timeout";

export type RedactionStatus = "not_applied" | "applied" | "failed";

export type ExtractionProvider =
  | "gemini_inline_image"
  | "gemini_inline_pdf"
  | "gemini_files_api_pdf" // deferred (48h retention; large PDFs)
  | "cloud_vision" // deferred (bounding boxes)
  | "document_ai" // deferred (KVP/forms)
  | "none";

export type VerificationStatus =
  | "suggested" // default after extraction; a system suggestion, NOT trusted
  | "high_confidence_suggested" // strong grounding; still only a suggestion, NOT trusted
  | "needs_review" // weak grounding or high-risk unsupported -> must be reviewed
  | "accepted" // user confirmed (trusted)
  | "edited" // user corrected (redacted, trusted)
  | "rejected"; // user marked as AI misinterpretation (excluded)

export type ExtractedFactType =
  | "phone_number"
  | "url"
  | "amount"
  | "transaction_ref"
  | "person_name"
  | "organization"
  | "date"
  | "time"
  | "otp_request"
  | "payment_request";

export type ExtractionSourceType =
  | "screenshot_sms"
  | "screenshot_chat"
  | "screenshot_receipt"
  | "pdf_receipt"
  | "pdf_letter"
  | "other";

export type VerificationMatch = "exact_match" | "normalized_match" | "weak_match" | "unsupported";

export type VisualSignalType =
  | "urgency_language"
  | "request_for_reversal"
  | "possible_brand_impersonation"
  | "personal_number_claiming_official_brand"
  | "suspicious_link"
  | "otp_or_pin_request"
  | "document_layout_anomaly"
  | "cropped_or_missing_context";

/** Fact types whose raw/full-normalized values must NEVER be persisted (mask only). */
export const SENSITIVE_FACT_TYPES: ReadonlySet<ExtractedFactType> = new Set<ExtractedFactType>([
  "phone_number",
  "person_name",
  "otp_request",
  "payment_request",
]);

/** Fact types where an unsupported claim forces human review. */
export const HIGH_RISK_FACT_TYPES: ReadonlySet<ExtractedFactType> = new Set<ExtractedFactType>([
  "phone_number",
  "url",
  "amount",
  "transaction_ref",
  "payment_request",
]);

/** Schema version stamped on persisted artifacts for future migrations. */
export const EXTRACTION_SCHEMA_VERSION = "2026-06-23";

/** Caps so an embedded artifact keeps the case doc well under Firestore's 1 MiB limit. */
export const MAX_EXTRACTION_TEXT_CHARS = 20000;
export const MAX_EXTRACTED_FACTS = 50;
export const MAX_VISUAL_SIGNALS = 30;

export interface BoundingBox {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PrivacyFlags {
  containedSensitiveTypes: string[];
  redactionApplied: boolean;
  /** Invariant: raw extracted text is never persisted, so this is always false. */
  rawTextPersisted: false;
  doNotSendExternal?: boolean;
}

export interface VisualSignal {
  signalType: VisualSignalType;
  description: string; // redacted
  severity: "low" | "medium" | "high";
  evidenceQuote?: string; // redacted
  sourcePage?: number;
}

export interface ExtractionValidation {
  groundingCoverage: number; // verified facts / total facts
  unsupportedClaims: string[]; // redacted
  highRiskUnsupported: boolean;
  requiresHumanReview: boolean;
  reviewReason?: string;
}

/** A single grounded, source-mapped, REDACTED fact persisted on the evidence item. */
export interface ExtractedFact {
  id: string;
  artifactId: string;
  evidenceId: string; // source mapping back to the evidence item
  caseId: string;
  ownerId: string;
  type: ExtractedFactType;
  redactedValue: string;
  /** Persisted only for non-sensitive types (e.g. amounts). */
  normalizedValue?: string;
  evidenceQuote: string; // redacted before persistence
  sourcePage?: number;
  /** Deferred: always null in Sprint 3 (requires Cloud Vision / Document AI). */
  sourceRegion?: BoundingBox | null;
  confidence: number; // 0..1
  verification: VerificationMatch; // computed pre-redaction; a SUGGESTION only
  verificationStatus: VerificationStatus;
  verifiedByUser: boolean; // true only after user Accept/Edit; gates trusted analysis input
  verifiedByUid?: string;
  verificationNotes?: string; // redacted before persistence
  editedValue?: string; // redacted; set only on user Edit (Sprint 4)
  extractedAt: string;
  privacyFlags: PrivacyFlags;
}

/** The persisted, redacted per-evidence extraction. Embedded (bounded) on the evidence item. */
export interface ExtractedArtifact {
  schemaVersion: string;
  evidenceId: string;
  ownerId: string;
  caseId: string;
  sourceType: ExtractionSourceType;
  provider: ExtractionProvider;
  extractionRunId: string;
  // rawVisibleText is intentionally absent: memory-only, never persisted.
  redactedText: string; // persisted, length-capped
  languageHint?: string;
  facts: ExtractedFact[];
  visualSignals: VisualSignal[];
  uncertaintyNotes: string[];
  validation: ExtractionValidation;
  extractionStatus: ExtractionStatus;
  redactionStatus: RedactionStatus;
  requiresHumanReview: boolean;
  extractedAt: string;
  privacyFlags: PrivacyFlags;
}

/**
 * Per-attempt audit record stored at `cases/{caseId}/extractionRuns/{runId}` to avoid case-doc bloat.
 * Carries NO text, prompt, response, OCR, signed URL, or secret. Counts and status only.
 */
export interface ExtractionRun {
  id: string;
  evidenceId: string;
  caseId: string;
  ownerId: string;
  provider: ExtractionProvider;
  model: string;
  status: "queued" | "running" | "succeeded" | "failed" | "timeout";
  consentGiven: true;
  consentRecordedAt: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  factCount?: number;
  requiresHumanReview?: boolean;
  redactionStatus: RedactionStatus;
  errorType?: string; // safeErrorType only; never a message/stack
}

/** A single fact as returned by the model BEFORE grounding/redaction. Memory-only. */
export interface RawExtractedFact {
  type: ExtractedFactType;
  rawValue: string;
  evidenceQuote: string;
  sourcePage?: number;
  confidence?: number;
}

/** Raw model output. Request-memory ONLY. NEVER written to Firestore/Storage/disk/logs. */
export interface RawExtraction {
  provider: ExtractionProvider;
  rawVisibleText: string;
  languageHint?: string;
  facts: RawExtractedFact[];
  visualSignals: VisualSignal[];
  uncertaintyNotes: string[];
}

export interface AnalysisBundleItem {
  evidenceId: string;
  sourceType: string;
  /** Included only when the artifact has >= 1 user-accepted fact. */
  redactedText?: string;
  acceptedFacts: ExtractedFact[];
}

/** Compiled pass-B input. In-memory, not persisted. Contains only trusted/redacted content. */
export interface AnalysisInputBundle {
  caseId: string;
  ownerId: string;
  builtAt: string;
  items: AnalysisBundleItem[];
  originalTextEvidence: Array<{ evidenceId: string; redactedText: string }>;
  multimodalEvidenceSummary: {
    evidenceCount: number;
    acceptedFactCount: number;
    visualSignalCount: number;
    requiresHumanReview: boolean;
    notes: string[];
  };
}

/**
 * A fact is trusted analysis input ONLY after explicit user acceptance (Decision 2).
 * Canonical status is authoritative: grounding strength and stale `verifiedByUser` flags are not
 * enough to trust a fact.
 */
export function isTrustedFact(
  f: Pick<ExtractedFact, "verifiedByUser" | "verificationStatus">,
): boolean {
  return f.verificationStatus === "accepted";
}
