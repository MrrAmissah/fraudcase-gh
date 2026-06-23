/**
 * Thin Accept/Reject verification for extracted facts (Sprint 3).
 *
 * A fact becomes trusted analysis input ONLY when the owner accepts it (sets `verifiedByUser`).
 * Reject excludes it. The full Edit flow and richer reviewer UX are Sprint 4. This function is pure
 * (no I/O) so owner-isolation and state transitions are unit-tested; the route stays thin glue and
 * is responsible for auth, ownership, and redacting any verification notes before they arrive here.
 */
import type { ExtractedArtifact, ExtractedFact } from "./types";

export type FactVerificationDecision = "accept" | "reject";

export interface ApplyVerificationInput {
  artifact: ExtractedArtifact | undefined;
  factId: string;
  decision: FactVerificationDecision;
  uid: string;
  /** Already redacted by the caller. */
  notesRedacted?: string;
}

export type VerificationFailure = "no_artifact" | "fact_not_found" | "invalid_decision";

// Flat result (matches the repo's FileValidationResult style); boolean-discriminant union
// narrowing is unreliable under the project's non-strict tsconfig.
export interface ApplyVerificationResult {
  ok: boolean;
  reason?: VerificationFailure;
  artifact?: ExtractedArtifact;
  fact?: ExtractedFact;
}

export function applyFactVerification(input: ApplyVerificationInput): ApplyVerificationResult {
  if (input.decision !== "accept" && input.decision !== "reject") {
    return { ok: false, reason: "invalid_decision" };
  }
  if (!input.artifact) return { ok: false, reason: "no_artifact" };

  const idx = input.artifact.facts.findIndex((f) => f.id === input.factId);
  if (idx < 0) return { ok: false, reason: "fact_not_found" };

  const accepted = input.decision === "accept";
  const updatedFact: ExtractedFact = {
    ...input.artifact.facts[idx],
    verificationStatus: accepted ? "accepted" : "rejected",
    verifiedByUser: accepted, // reject is an explicit decision but does NOT make a fact trusted
    verifiedByUid: input.uid,
    verificationNotes: input.notesRedacted,
  };

  const facts = [...input.artifact.facts];
  facts[idx] = updatedFact;
  // Return a new artifact object (immutability) so callers never mutate the stored value in place.
  return { ok: true, artifact: { ...input.artifact, facts }, fact: updatedFact };
}
