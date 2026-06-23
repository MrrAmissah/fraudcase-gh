import { test } from "node:test";
import assert from "node:assert/strict";
import { applyFactVerification } from "../verification";
import { isTrustedFact } from "../types";
import type { ExtractedArtifact, ExtractedFact } from "../types";

function fact(id: string): ExtractedFact {
  return {
    id,
    artifactId: "run-1",
    evidenceId: "ev-1",
    caseId: "c1",
    ownerId: "u1",
    type: "amount",
    redactedValue: "GHS 1,500.00",
    evidenceQuote: "received GHS 1,500.00",
    confidence: 0.9,
    verification: "exact_match",
    verificationStatus: "high_confidence_suggested",
    verifiedByUser: false,
    extractedAt: "2026-06-23T00:00:00Z",
    privacyFlags: { containedSensitiveTypes: [], redactionApplied: true, rawTextPersisted: false },
  };
}

function artifact(): ExtractedArtifact {
  return {
    schemaVersion: "2026-06-23",
    evidenceId: "ev-1",
    ownerId: "u1",
    caseId: "c1",
    sourceType: "screenshot_receipt",
    provider: "gemini_inline_image",
    extractionRunId: "run-1",
    redactedText: "received GHS 1,500.00",
    facts: [fact("xf-1"), fact("xf-2")],
    visualSignals: [],
    uncertaintyNotes: [],
    validation: { groundingCoverage: 1, unsupportedClaims: [], highRiskUnsupported: false, requiresHumanReview: false },
    extractionStatus: "extracted",
    redactionStatus: "applied",
    requiresHumanReview: false,
    extractedAt: "2026-06-23T00:00:00Z",
    privacyFlags: { containedSensitiveTypes: ["amount"], redactionApplied: true, rawTextPersisted: false },
  };
}

test("accept makes a fact trusted; the suggestion was not", () => {
  const before = artifact();
  assert.equal(isTrustedFact(before.facts[0]), false);
  const res = applyFactVerification({ artifact: before, factId: "xf-1", decision: "accept", uid: "u1" });
  assert.ok(res.ok);
  if (res.ok) {
    assert.equal(res.fact.verificationStatus, "accepted");
    assert.equal(res.fact.verifiedByUser, true);
    assert.equal(res.fact.verifiedByUid, "u1");
    assert.equal(isTrustedFact(res.fact), true);
  }
});

test("reject is an explicit decision but never trusts the fact", () => {
  const res = applyFactVerification({ artifact: artifact(), factId: "xf-1", decision: "reject", uid: "u1" });
  assert.ok(res.ok);
  if (res.ok) {
    assert.equal(res.fact.verificationStatus, "rejected");
    assert.equal(res.fact.verifiedByUser, false);
    assert.equal(isTrustedFact(res.fact), false);
  }
});

test("applyFactVerification does not mutate the input artifact", () => {
  const before = artifact();
  const res = applyFactVerification({ artifact: before, factId: "xf-1", decision: "accept", uid: "u1" });
  assert.ok(res.ok);
  assert.equal(before.facts[0].verifiedByUser, false, "original artifact must be untouched");
});

test("missing fact and missing artifact are discrete errors", () => {
  assert.deepEqual(applyFactVerification({ artifact: artifact(), factId: "nope", decision: "accept", uid: "u1" }), {
    ok: false,
    reason: "fact_not_found",
  });
  assert.deepEqual(applyFactVerification({ artifact: undefined, factId: "xf-1", decision: "accept", uid: "u1" }), {
    ok: false,
    reason: "no_artifact",
  });
});

test("invalid decision is rejected", () => {
  assert.deepEqual(
    applyFactVerification({ artifact: artifact(), factId: "xf-1", decision: "maybe" as any, uid: "u1" }),
    { ok: false, reason: "invalid_decision" },
  );
});
