import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isTrustedFact,
  SENSITIVE_FACT_TYPES,
  HIGH_RISK_FACT_TYPES,
  type ExtractedFact,
} from "../types";

function fact(partial: Partial<ExtractedFact>): ExtractedFact {
  return {
    id: "f1",
    artifactId: "a1",
    evidenceId: "e1",
    caseId: "c1",
    ownerId: "u1",
    type: "amount",
    redactedValue: "GHS 1,500.00",
    evidenceQuote: "received GHS 1,500.00",
    confidence: 0.9,
    verification: "exact_match",
    verificationStatus: "suggested",
    verifiedByUser: false,
    extractedAt: "2026-06-23T00:00:00Z",
    privacyFlags: { containedSensitiveTypes: [], redactionApplied: true, rawTextPersisted: false },
    ...partial,
  };
}

test("isTrustedFact: unaccepted suggestions are never trusted (Decision 2)", () => {
  assert.equal(isTrustedFact(fact({ verificationStatus: "suggested", verifiedByUser: false })), false);
  assert.equal(
    isTrustedFact(fact({ verificationStatus: "high_confidence_suggested", verifiedByUser: false })),
    false,
  );
  assert.equal(isTrustedFact(fact({ verificationStatus: "needs_review", verifiedByUser: false })), false);
  assert.equal(isTrustedFact(fact({ verificationStatus: "rejected", verifiedByUser: false })), false);
});

test("isTrustedFact: only user acceptance makes a fact trusted", () => {
  assert.equal(isTrustedFact(fact({ verificationStatus: "accepted", verifiedByUser: true })), true);
  assert.equal(isTrustedFact(fact({ verificationStatus: "edited", verifiedByUser: true })), true);
  // verifiedByUser flag alone is sufficient (defensive).
  assert.equal(isTrustedFact(fact({ verificationStatus: "suggested", verifiedByUser: true })), true);
});

test("sensitive fact types include phone and exclude amount", () => {
  assert.ok(SENSITIVE_FACT_TYPES.has("phone_number"));
  assert.ok(SENSITIVE_FACT_TYPES.has("person_name"));
  assert.ok(!SENSITIVE_FACT_TYPES.has("amount"));
  assert.ok(!SENSITIVE_FACT_TYPES.has("url"));
});

test("high-risk fact types force review when unsupported", () => {
  for (const t of ["phone_number", "url", "amount", "transaction_ref", "payment_request"] as const) {
    assert.ok(HIGH_RISK_FACT_TYPES.has(t), `${t} should be high-risk`);
  }
  assert.ok(!HIGH_RISK_FACT_TYPES.has("organization"));
});
