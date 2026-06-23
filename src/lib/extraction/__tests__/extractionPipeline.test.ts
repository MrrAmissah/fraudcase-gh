import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateExtractionPreconditions,
  resolveExtractionKind,
  resolveSourceType,
  runEvidenceExtraction,
} from "../extractionPipeline";

const owned = { ownerId: "owner-1" };
const evItem = { id: "ev-1", storagePath: "users/owner-1/cases/c1/evidence/ev-1/a.png" };

test("preconditions: flag disabled wins first", () => {
  assert.equal(
    evaluateExtractionPreconditions({ flagEnabled: false, caseData: owned, evidenceItem: evItem, uid: "owner-1", consentGiven: true }),
    "flag_disabled",
  );
});

test("preconditions: non-owner is blocked even with consent", () => {
  assert.equal(
    evaluateExtractionPreconditions({ flagEnabled: true, caseData: owned, evidenceItem: evItem, uid: "intruder", consentGiven: true }),
    "not_owner",
  );
});

test("preconditions: missing evidence item is 404-shaped", () => {
  assert.equal(
    evaluateExtractionPreconditions({ flagEnabled: true, caseData: owned, evidenceItem: null, uid: "owner-1", consentGiven: true }),
    "evidence_not_found",
  );
});

test("preconditions: consent must be exactly true", () => {
  for (const consent of [false, undefined, "true", 1]) {
    assert.equal(
      evaluateExtractionPreconditions({ flagEnabled: true, caseData: owned, evidenceItem: evItem, uid: "owner-1", consentGiven: consent }),
      "consent_missing",
    );
  }
});

test("preconditions: all gates satisfied -> proceed", () => {
  assert.equal(
    evaluateExtractionPreconditions({ flagEnabled: true, caseData: owned, evidenceItem: evItem, uid: "owner-1", consentGiven: true }),
    "proceed",
  );
});

test("resolveExtractionKind: only png/jpeg/pdf are supported (webp/text/unknown excluded)", () => {
  assert.equal(resolveExtractionKind("png"), "image");
  assert.equal(resolveExtractionKind("jpeg"), "image");
  assert.equal(resolveExtractionKind("pdf"), "pdf");
  assert.equal(resolveExtractionKind("webp"), null);
  assert.equal(resolveExtractionKind("text"), null);
  assert.equal(resolveExtractionKind("unknown"), null);
});

test("resolveSourceType maps evidence type + kind", () => {
  assert.equal(resolveSourceType("sms", "image"), "screenshot_sms");
  assert.equal(resolveSourceType("whatsapp", "image"), "screenshot_chat");
  assert.equal(resolveSourceType("receipt", "image"), "screenshot_receipt");
  assert.equal(resolveSourceType("document", "pdf"), "pdf_letter");
  assert.equal(resolveSourceType("receipt", "pdf"), "pdf_receipt");
});

const EXTRACT_JSON = JSON.stringify({
  visibleText: "received GHS 1,500.00. Contact 0542385934.",
  facts: [
    { type: "amount", rawValue: "GHS 1,500.00", evidenceQuote: "received GHS 1,500.00" },
    { type: "phone_number", rawValue: "0542385934", evidenceQuote: "Contact 0542385934" },
  ],
  visualSignals: [],
  uncertaintyNotes: [],
});
const okClient = { models: { generateContent: async () => ({ text: EXTRACT_JSON }) } };
const ctx = { evidenceId: "ev-1", ownerId: "owner-1", caseId: "c1", sourceType: "screenshot_receipt" as const };

test("runEvidenceExtraction: success yields a redacted artifact and a text-free run", async () => {
  const res = await runEvidenceExtraction({
    buffer: Buffer.from("x"),
    mimeType: "image/png",
    kind: "image",
    context: ctx,
    consentRecordedAt: "2026-06-23T00:00:00Z",
    runId: "run-1",
    opts: { client: okClient as any },
  });
  assert.equal(res.status, "succeeded");
  assert.ok(res.artifact);
  assert.equal(res.run.status, "succeeded");
  assert.equal(res.run.factCount, 2);
  // The audit run must carry NO text and NO raw phone digits.
  const runBlob = JSON.stringify(res.run);
  assert.ok(!runBlob.includes("0542385934"));
  assert.ok(!("redactedText" in (res.run as any)));
  assert.ok(!("rawVisibleText" in (res.run as any)));
  // The artifact masks the phone.
  const phone = res.artifact!.facts.find((f) => f.type === "phone_number")!;
  assert.equal(phone.redactedValue, "0542***934");
});

test("runEvidenceExtraction: no model (client null) audits a failed run, no artifact", async () => {
  const res = await runEvidenceExtraction({
    buffer: Buffer.from("x"),
    mimeType: "image/png",
    kind: "image",
    context: ctx,
    consentRecordedAt: "2026-06-23T00:00:00Z",
    runId: "run-2",
    opts: { client: null },
  });
  assert.equal(res.status, "skipped");
  assert.equal(res.run.status, "failed");
  assert.equal(res.run.redactionStatus, "not_applied");
  assert.equal(res.artifact, undefined);
});

test("runEvidenceExtraction: timeout audits a timeout run, no artifact", async () => {
  const slow = {
    models: {
      generateContent: () =>
        new Promise<{ text?: string }>((resolve) => setTimeout(() => resolve({ text: EXTRACT_JSON }), 120)),
    },
  };
  const res = await runEvidenceExtraction({
    buffer: Buffer.from("x"),
    mimeType: "image/png",
    kind: "image",
    context: ctx,
    consentRecordedAt: "2026-06-23T00:00:00Z",
    runId: "run-3",
    opts: { client: slow as any, timeoutMs: 20 },
  });
  assert.equal(res.run.status, "timeout");
  assert.equal(res.artifact, undefined);
});
