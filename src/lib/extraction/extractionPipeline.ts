/**
 * Pure decision + orchestration logic for the consent-gated extraction endpoint.
 *
 * Keeping this out of `server.ts` (which stays a thin glue handler, mirroring how it delegates to
 * `src/lib/security/*`) lets the owner-isolation, consent, flag, and file-kind rules be unit-tested
 * without an HTTP harness. `isCaseOwner` is reused rather than re-implemented.
 */
import { isCaseOwner } from "../security/ownerIsolation";
import type { FileKind } from "../security/fileValidation";
import { buildPersistedArtifact, type ExtractionContext } from "./redactExtractedText";
import {
  extractVisualEvidence,
  extractionModelId,
  type ExtractOptions,
  type ExtractInput,
} from "./multimodalExtractor";
import {
  type ExtractedArtifact,
  type ExtractionRun,
  type ExtractionSourceType,
} from "./types";

export type ExtractionDecision =
  | "proceed"
  | "flag_disabled"
  | "not_owner"
  | "evidence_not_found"
  | "consent_missing";

export interface PreconditionInput {
  flagEnabled: boolean;
  caseData: { ownerId?: string } | null | undefined;
  evidenceItem: { id?: string; storagePath?: string } | null | undefined;
  uid: string;
  consentGiven: unknown;
}

/**
 * Gate the request in a safe order: flag, then ownership, then evidence existence, then consent.
 * Consent is checked before any file bytes are read so an unconsented request never touches storage.
 */
export function evaluateExtractionPreconditions(input: PreconditionInput): ExtractionDecision {
  if (!input.flagEnabled) return "flag_disabled";
  if (!isCaseOwner(input.caseData, input.uid)) return "not_owner";
  if (!input.evidenceItem || !input.evidenceItem.id) return "evidence_not_found";
  if (input.consentGiven !== true) return "consent_missing";
  return "proceed";
}

/** HTTP mapping for precondition failures (used by the thin route + tested here). */
export const EXTRACTION_DECISION_HTTP: Record<
  Exclude<ExtractionDecision, "proceed">,
  { status: number; error: string }
> = {
  flag_disabled: { status: 503, error: "Multimodal extraction is not enabled." },
  not_owner: { status: 403, error: "Forbidden: Access denied to this case resource." },
  evidence_not_found: { status: 404, error: "Evidence item not found." },
  consent_missing: { status: 400, error: "Consent is required to run AI extraction on this evidence." },
};

/**
 * Map the REAL detected file kind to an extraction kind. MVP supports PNG/JPEG images and PDFs only;
 * `webp`, text, and unknown are intentionally excluded (do not widen scope to the upload allowlist).
 */
export function resolveExtractionKind(detectedKind: FileKind): "image" | "pdf" | null {
  if (detectedKind === "png" || detectedKind === "jpeg") return "image";
  if (detectedKind === "pdf") return "pdf";
  return null;
}

/** Derive a redaction-safe source type from the evidence type and resolved kind. */
export function resolveSourceType(evidenceType: string | undefined, kind: "image" | "pdf"): ExtractionSourceType {
  if (kind === "pdf") {
    if (evidenceType === "document") return "pdf_letter";
    return "pdf_receipt";
  }
  switch (evidenceType) {
    case "sms":
      return "screenshot_sms";
    case "whatsapp":
      return "screenshot_chat";
    case "receipt":
      return "screenshot_receipt";
    default:
      return "other";
  }
}

export interface RunExtractionParams {
  buffer: Buffer;
  mimeType: string;
  kind: "image" | "pdf";
  context: { evidenceId: string; ownerId: string; caseId: string; sourceType: ExtractionSourceType };
  consentRecordedAt: string;
  runId: string;
  opts?: ExtractOptions;
}

export interface RunExtractionResult {
  /** Present only on success. */
  artifact?: ExtractedArtifact;
  /** Always present, including on failure/timeout, for audit completeness. Carries NO text. */
  run: ExtractionRun;
  status: "succeeded" | "failed" | "timeout" | "skipped";
}

/**
 * Orchestrate one extraction attempt: model call -> grounding+redaction -> persist-ready artifact,
 * plus an audit `ExtractionRun` that is always produced (even on failure/timeout) with status only.
 * Performs no I/O persistence itself; the caller writes the returned objects.
 */
export async function runEvidenceExtraction(params: RunExtractionParams): Promise<RunExtractionResult> {
  const startedAt = new Date().toISOString();
  const input: ExtractInput = { buffer: params.buffer, mimeType: params.mimeType, kind: params.kind };
  const outcome = await extractVisualEvidence(input, params.opts);
  const finishedAt = new Date().toISOString();
  const durationMs = Date.parse(finishedAt) - Date.parse(startedAt);

  const baseRun: ExtractionRun = {
    id: params.runId,
    evidenceId: params.context.evidenceId,
    caseId: params.context.caseId,
    ownerId: params.context.ownerId,
    provider: outcome.raw.provider,
    model: extractionModelId(),
    status: "running",
    consentGiven: true,
    consentRecordedAt: params.consentRecordedAt,
    startedAt,
    finishedAt,
    durationMs: Number.isFinite(durationMs) ? durationMs : undefined,
    redactionStatus: "not_applied",
  };

  if (outcome.status === "succeeded") {
    const ctx: ExtractionContext = {
      evidenceId: params.context.evidenceId,
      ownerId: params.context.ownerId,
      caseId: params.context.caseId,
      sourceType: params.context.sourceType,
      extractionRunId: params.runId,
      extractedAt: finishedAt,
    };
    const artifact = buildPersistedArtifact(outcome.raw, ctx);
    const run: ExtractionRun = {
      ...baseRun,
      status: "succeeded",
      factCount: artifact.facts.length,
      requiresHumanReview: artifact.requiresHumanReview,
      redactionStatus: "applied",
    };
    return { artifact, run, status: "succeeded" };
  }

  // skipped (no model), failed, or timeout: audit the attempt, persist no artifact.
  const status = outcome.status === "timeout" ? "timeout" : "failed";
  const run: ExtractionRun = {
    ...baseRun,
    status,
    errorType: outcome.errorType,
  };
  return { run, status: outcome.status };
}
