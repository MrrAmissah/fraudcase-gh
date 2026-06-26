import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAnalysisInputBundle, bundleToAnalysisEvidenceItems } from "../sourceMapping";
import type { EvidenceItem } from "../../../types/evidence";
import type { ExtractedArtifact, ExtractedFact, VerificationStatus } from "../types";

function extractedFact(status: VerificationStatus, verifiedByUser: boolean): ExtractedFact {
  return {
    id: "xf-1",
    artifactId: "run-1",
    evidenceId: "img-1",
    caseId: "c1",
    ownerId: "u1",
    type: "amount",
    redactedValue: "GHS 1,500.00",
    evidenceQuote: "received GHS 1,500.00",
    confidence: 0.9,
    verification: "exact_match",
    verificationStatus: status,
    verifiedByUser,
    extractedAt: "2026-06-23T00:00:00Z",
    privacyFlags: { containedSensitiveTypes: ["amount"], redactionApplied: true, rawTextPersisted: false },
  };
}

function imageItem(fact: ExtractedFact): EvidenceItem {
  const artifact: ExtractedArtifact = {
    schemaVersion: "2026-06-23",
    evidenceId: "img-1",
    ownerId: "u1",
    caseId: "c1",
    sourceType: "screenshot_receipt",
    provider: "gemini_inline_image",
    extractionRunId: "run-1",
    redactedText: "MTN MoMo received GHS 1,500.00 reversal request",
    facts: [fact],
    visualSignals: [],
    uncertaintyNotes: [],
    validation: { groundingCoverage: 1, unsupportedClaims: [], highRiskUnsupported: false, requiresHumanReview: false },
    extractionStatus: "extracted",
    redactionStatus: "applied",
    requiresHumanReview: false,
    extractedAt: "2026-06-23T00:00:00Z",
    privacyFlags: { containedSensitiveTypes: ["amount"], redactionApplied: true, rawTextPersisted: false },
  };
  return {
    id: "img-1",
    caseId: "c1",
    type: "receipt",
    title: "MoMo screenshot",
    extractionStatus: "extracted",
    extractedArtifact: artifact,
    createdAt: "2026-06-23T00:00:00Z",
  };
}

const textItem: EvidenceItem = {
  id: "txt-1",
  caseId: "c1",
  type: "sms",
  title: "Delivery SMS",
  redactedText: "GH-POST: pay a clearance fee.",
  createdAt: "2026-06-23T00:00:00Z",
};

test("unaccepted suggestion contributes ZERO text to analysis (Decision 2)", () => {
  const items = [textItem, imageItem(extractedFact("high_confidence_suggested", false))];
  const bundle = buildAnalysisInputBundle("c1", "u1", items);

  // The image item's artifact text is withheld until a fact is accepted.
  const multimodal = bundle.items.find((i) => i.evidenceId === "img-1")!;
  assert.equal(multimodal.acceptedFacts.length, 0);
  assert.equal(multimodal.redactedText, undefined);
  assert.equal(bundle.multimodalEvidenceSummary.acceptedFactCount, 0);

  // No synthetic analysis item is produced for an unaccepted suggestion.
  const analysisItems = bundleToAnalysisEvidenceItems(bundle);
  assert.equal(analysisItems.length, 0);
});

test("after acceptance, ONLY the accepted fact (not the artifact transcript) reaches analysis", () => {
  const items = [textItem, imageItem(extractedFact("accepted", true))];
  const bundle = buildAnalysisInputBundle("c1", "u1", items);

  const multimodal = bundle.items.find((i) => i.evidenceId === "img-1")!;
  assert.equal(multimodal.acceptedFacts.length, 1);
  // The bundle still carries the transcript as inspection metadata...
  assert.equal(multimodal.redactedText, "MTN MoMo received GHS 1,500.00 reversal request");
  assert.equal(bundle.multimodalEvidenceSummary.acceptedFactCount, 1);

  const analysisItems = bundleToAnalysisEvidenceItems(bundle);
  assert.equal(analysisItems.length, 1);
  // ...but only the accepted fact line feeds analysis; the unaccepted transcript text is NOT dragged in.
  assert.ok(analysisItems[0].redactedText!.includes("amount: GHS 1,500.00"));
  assert.ok(!analysisItems[0].redactedText!.includes("MTN MoMo received"));
  assert.ok(!analysisItems[0].redactedText!.includes("reversal request"));
});

test("rejected facts never reach analysis input", () => {
  const items = [imageItem(extractedFact("rejected", false))];
  const bundle = buildAnalysisInputBundle("c1", "u1", items);
  assert.equal(bundle.multimodalEvidenceSummary.acceptedFactCount, 0);
  assert.equal(bundleToAnalysisEvidenceItems(bundle).length, 0);
});

test("stale verifiedByUser does not let suggested facts reach analysis input", () => {
  const items = [imageItem(extractedFact("suggested", true))];
  const bundle = buildAnalysisInputBundle("c1", "u1", items);
  assert.equal(bundle.multimodalEvidenceSummary.acceptedFactCount, 0);
  assert.equal(bundle.items[0].acceptedFacts.length, 0);
  assert.equal(bundle.items[0].redactedText, undefined);
  assert.equal(bundleToAnalysisEvidenceItems(bundle).length, 0);
});

test("original typed/pasted text evidence is always included", () => {
  const bundle = buildAnalysisInputBundle("c1", "u1", [textItem]);
  assert.equal(bundle.originalTextEvidence.length, 1);
  assert.equal(bundle.originalTextEvidence[0].evidenceId, "txt-1");
});
