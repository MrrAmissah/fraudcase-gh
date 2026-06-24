import { test } from "node:test";
import assert from "node:assert/strict";
import {
  factStatusBadge,
  factConfidenceLabel,
  factGroundingLabel,
  isExtractable,
  extractionUiState,
  factCounts,
  orderedFacts,
} from "../verificationView";
import type { ExtractedArtifact, ExtractedFact, VerificationStatus } from "../types";

function f(status: VerificationStatus, verifiedByUser: boolean, extra: Partial<ExtractedFact> = {}): ExtractedFact {
  return {
    id: "xf-" + Math.random().toString(36).slice(2),
    artifactId: "run-1",
    evidenceId: "ev-1",
    caseId: "c1",
    ownerId: "u1",
    type: "amount",
    redactedValue: "GHS 1,500.00",
    evidenceQuote: "received GHS 1,500.00",
    confidence: 0.9,
    verification: "exact_match",
    verificationStatus: status,
    verifiedByUser,
    extractedAt: "2026-06-24T00:00:00Z",
    privacyFlags: { containedSensitiveTypes: [], redactionApplied: true, rawTextPersisted: false },
    ...extra,
  };
}

test("CRITICAL: high_confidence_suggested renders as a suggestion, NOT trusted", () => {
  const badge = factStatusBadge(f("high_confidence_suggested", false));
  assert.equal(badge.isTrusted, false, "strong grounding must never read as trusted (Decision 2)");
  assert.equal(badge.tone, "suggested");
  assert.equal(badge.label, "Suggested by AI");
});

test("only user acceptance produces a trusted badge", () => {
  assert.equal(factStatusBadge(f("accepted", true)).isTrusted, true);
  assert.equal(factStatusBadge(f("accepted", true)).tone, "trusted");
  // plain suggested + high-confidence suggested + needs_review + rejected are all non-trusted,
  // even if stale persisted flags claim verifiedByUser.
  assert.equal(factStatusBadge(f("suggested", false)).isTrusted, false);
  assert.equal(factStatusBadge(f("suggested", true)).isTrusted, false);
  assert.equal(factStatusBadge(f("high_confidence_suggested", true)).isTrusted, false);
  assert.equal(factStatusBadge(f("needs_review", false)).tone, "caution");
  assert.equal(factStatusBadge(f("rejected", false)).tone, "rejected");
});

test("rejected badge dominates inconsistent verifiedByUser state", () => {
  const badge = factStatusBadge(f("rejected", true));
  assert.equal(badge.isTrusted, false);
  assert.equal(badge.tone, "rejected");
  assert.equal(badge.label, "Rejected");
});

test("grounding and confidence are framed as subordinate AI signals", () => {
  assert.match(factGroundingLabel("exact_match"), /^AI grounding:/);
  assert.match(factConfidenceLabel(0.9), /^AI confidence: high/);
  assert.match(factConfidenceLabel(0.7), /medium/);
  assert.match(factConfidenceLabel(0.3), /low/);
});

test("isExtractable: PNG/JPEG/PDF yes, webp/text/no-file no", () => {
  assert.equal(isExtractable({ fileName: "a.png", fileType: "image/png" }), true);
  assert.equal(isExtractable({ fileName: "a.jpg", fileType: "image/jpeg" }), true);
  assert.equal(isExtractable({ fileName: "a.pdf", fileType: "application/pdf" }), true);
  assert.equal(isExtractable({ fileName: "a.webp", fileType: "image/webp" }), false);
  assert.equal(isExtractable({ fileName: "a.txt", fileType: "text/plain" }), false);
  assert.equal(isExtractable({ fileType: "image/png" }), false, "no stored file -> not extractable");
});

test("extractionUiState covers every non-happy path", () => {
  assert.equal(extractionUiState({ fileName: "n.txt", fileType: "text/plain" }), "not_applicable");
  assert.equal(extractionUiState({ fileName: "a.png", fileType: "image/png" }), "none");
  assert.equal(extractionUiState({ fileName: "a.png", fileType: "image/png", extractionStatus: "running" }), "in_progress");
  assert.equal(extractionUiState({ fileName: "a.png", fileType: "image/png", extractionStatus: "failed" }), "failed");
  assert.equal(extractionUiState({ fileName: "a.png", fileType: "image/png", extractionStatus: "timeout" }), "timeout");
  const withFacts = { fileName: "a.png", fileType: "image/png", extractionStatus: "extracted", extractedArtifact: { facts: [f("suggested", false)] } as unknown as ExtractedArtifact };
  assert.equal(extractionUiState(withFacts), "extracted");
  const noFacts = { fileName: "a.png", fileType: "image/png", extractionStatus: "extracted", extractedArtifact: { facts: [] } as unknown as ExtractedArtifact };
  assert.equal(extractionUiState(noFacts), "extracted_no_facts");
});

test("factCounts and orderedFacts reflect acceptance state", () => {
  const artifact = { facts: [f("accepted", true), f("rejected", false), f("needs_review", false), f("suggested", false)] } as unknown as ExtractedArtifact;
  const c = factCounts(artifact);
  assert.equal(c.total, 4);
  assert.equal(c.accepted, 1);
  assert.equal(c.rejected, 1);
  assert.equal(c.pending, 2);
  // needs_review first, rejected last
  const ordered = orderedFacts(artifact);
  assert.equal(ordered[0].verificationStatus, "needs_review");
  assert.equal(ordered[ordered.length - 1].verificationStatus, "rejected");
});
