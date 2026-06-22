import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeFraudCase, generateHeuristicMockAnalysis } from "./analyzeFraudCase";
import { getRiskLevel } from "../utils/risk";
import { EvidenceItem } from "../../types/evidence";

// Tests target the heuristic fallback directly (deterministic, no env/import-order dependence).
// They lock in the analysis-quality guarantees: real risk for scams, and zero fabricated entities.

let seq = 0;
function evidence(
  type: EvidenceItem["type"],
  title: string,
  originalText: string
): EvidenceItem {
  seq += 1;
  return {
    id: `ev-test-${seq}`,
    caseId: "case-test",
    type,
    title,
    originalText,
    createdAt: "2026-06-18T14:32:00Z",
  };
}

test("fake delivery fee SMS produces medium/high risk (not low)", () => {
  const analysis = generateHeuristicMockAnalysis(
    "Delivery fee SMS",
    "Received a parcel delivery SMS asking to pay a small clearance fee.",
    [evidence("sms", "Delivery SMS", "GH-POST: your parcel is held, pay a small delivery clearance fee online.")]
  );

  assert.equal(analysis.scamCategory, "fake_delivery");
  assert.ok(analysis.riskScore >= 50, `expected riskScore >= 50, got ${analysis.riskScore}`);
  const level = getRiskLevel(analysis.riskScore).label;
  assert.notEqual(level, "Low");
  assert.ok(level === "High" || level === "Critical", `expected High/Critical, got ${level}`);
});

test("suspicious verification URL is not classified low risk", () => {
  const analysis = generateHeuristicMockAnalysis(
    "Suspicious link",
    "Got a message with a login verification link to secure my account.",
    [evidence("url", "Phishing link", "http://secure-login-verify.example/account")]
  );

  assert.ok(analysis.riskScore >= 50, `expected riskScore >= 50, got ${analysis.riskScore}`);
  assert.notEqual(getRiskLevel(analysis.riskScore).label, "Low");
});

test("no invented names or locations are returned", () => {
  // Evidence contains no personal name or location — these lists must be empty, never fabricated.
  const analysis = generateHeuristicMockAnalysis(
    "Delivery fee SMS",
    "Parcel delivery clearance fee requested.",
    [evidence("sms", "Delivery SMS", "GH-POST: pay a delivery clearance fee to release your parcel.")]
  );

  assert.deepEqual(analysis.extractedEntities.names, []);
  assert.deepEqual(analysis.extractedEntities.locations, []);
});

test("no fabricated url/amount/phone when evidence contains none", () => {
  // This case still classifies as fake_delivery (which previously injected placeholder
  // url/amount/phone fillers) — but with no such values in the evidence the lists stay empty.
  const analysis = generateHeuristicMockAnalysis(
    "Delivery issue",
    "A parcel delivery problem was reported with no link or amount provided.",
    [evidence("sms", "Delivery SMS", "GH-POST notice about a delivery; no website and no fee stated here.")]
  );

  assert.equal(analysis.scamCategory, "fake_delivery");
  assert.deepEqual(analysis.extractedEntities.urls, []);
  assert.deepEqual(analysis.extractedEntities.amounts, []);
  assert.deepEqual(analysis.extractedEntities.phoneNumbers, []);
});

test("extracts only exact evidence-derived urls and amounts", () => {
  const title = "Delivery";
  const description = "Parcel delivery clearance fee.";
  const evidenceText =
    "GH-POST: pay GHS 12.50 at https://ghana-post-clearance.cz/pay-fee to release parcel. Call 0240000000.";
  const corpus = `${title}\n${description}\n${evidenceText}`;

  const analysis = generateHeuristicMockAnalysis(title, description, [
    evidence("sms", "Delivery SMS", evidenceText),
  ]);

  // Captures the real values present in the evidence...
  assert.ok(analysis.extractedEntities.urls.includes("https://ghana-post-clearance.cz/pay-fee"));
  assert.ok(
    analysis.extractedEntities.amounts.some((a) => a.replace(/\s+/g, "").toUpperCase() === "GHS12.50")
  );
  assert.ok(analysis.extractedEntities.phoneNumbers.includes("0240000000"));

  // ...and every returned url/amount/phone appears verbatim in the supplied evidence (no fabrication).
  for (const u of analysis.extractedEntities.urls) {
    assert.ok(corpus.includes(u), `fabricated url not in evidence: ${u}`);
  }
  for (const a of analysis.extractedEntities.amounts) {
    assert.ok(corpus.toUpperCase().includes(a.toUpperCase()), `fabricated amount not in evidence: ${a}`);
  }
  for (const p of analysis.extractedEntities.phoneNumbers) {
    assert.ok(corpus.includes(p), `fabricated phone not in evidence: ${p}`);
  }
});

// --- Gemini timeout / slowness fallback (Sprint 2 hardening) ---

const VALID_ANALYSIS_JSON = JSON.stringify({
  scamCategory: "phishing",
  confidence: "high",
  riskScore: 70,
  shortSummary: "The message shows possible phishing indicators.",
  suspiciousIndicators: ["Urgent account verification request."],
  extractedEntities: {
    phoneNumbers: [], urls: [], names: [], organizations: [],
    amounts: [], dates: [], transactionReferences: [], locations: [],
  },
  timeline: [],
  evidenceChecklist: [],
  recommendedNextSteps: ["Do not click the link."],
  reportSummary: "Summary.",
  disclaimer: "Not a legal determination.",
});

test("uses the Gemini result (analysisProvider 'gemini') when the client responds in time", async () => {
  const client = { models: { generateContent: async () => ({ text: VALID_ANALYSIS_JSON }) } };
  const result = await analyzeFraudCase("t", "d", [], { client: client as any, timeoutMs: 1000 });
  assert.equal(result.analysisProvider, "gemini");
  assert.equal(result.scamCategory, "phishing");
});

test("falls back to the heuristic when Gemini exceeds the timeout (before the route timeout)", async () => {
  const slow = {
    models: {
      generateContent: () =>
        new Promise<{ text?: string }>((resolve) => {
          // Ref'd + short (>timeoutMs): the timeout still fires first, but the mock promise settles
          // before the event loop exits, so node:test does not cancel the test on CI (Node 22).
          setTimeout(() => resolve({ text: VALID_ANALYSIS_JSON }), 120);
        }),
    },
  };
  const start = Date.now();
  const result = await analyzeFraudCase(
    "Delivery fee SMS",
    "Parcel clearance fee requested.",
    [evidence("sms", "Delivery SMS", "GH-POST: pay a delivery clearance fee.")],
    { client: slow as any, timeoutMs: 30 },
  );
  assert.ok(Date.now() - start < 500, "fallback should fire at the timeout, not after Gemini resolves");
  assert.equal(result.analysisProvider, "heuristic");
  assert.equal(result.scamCategory, "fake_delivery");
});

test("client:null forces the heuristic", async () => {
  const result = await analyzeFraudCase("t", "d", [], { client: null });
  assert.equal(result.analysisProvider, "heuristic");
});

test("timeout fallback logs structured metadata and never raw evidence", async () => {
  const marker = "VICTIM-CHAT-0241234567-do-not-log";
  const lines: string[] = [];
  const origWarn = console.warn;
  const origLog = console.log;
  const sink = (...a: unknown[]) => lines.push(a.map(String).join(" "));
  console.warn = sink as typeof console.warn;
  console.log = sink as typeof console.log;
  try {
    const slow = {
      models: {
        generateContent: () =>
          new Promise<{ text?: string }>((resolve) => {
            setTimeout(() => resolve({ text: "{}" }), 120);
          }),
      },
    };
    const result = await analyzeFraudCase("t", marker, [evidence("sms", "t", marker)], {
      client: slow as any,
      timeoutMs: 20,
    });
    assert.equal(result.analysisProvider, "heuristic");
  } finally {
    console.warn = origWarn;
    console.log = origLog;
  }
  const joined = lines.join("\n");
  assert.ok(joined.includes("gemini_analysis_timeout"), "expected a structured timeout event");
  assert.ok(!joined.includes(marker), "structured log must never contain raw evidence");
});

test("heuristic fallback stays non-accusatory (no 'confirmed fraud' wording)", () => {
  const a = generateHeuristicMockAnalysis(
    "Delivery fee SMS",
    "Parcel clearance fee requested.",
    [evidence("sms", "Delivery SMS", "GH-POST: pay a clearance fee.")],
  );
  const blob =
    `${a.shortSummary} ${a.disclaimer} ${a.suspiciousIndicators.join(" ")} ${a.recommendedNextSteps.join(" ")}`.toLowerCase();
  for (const banned of ["confirmed fraud", "confirmed scam", "is a scammer", "scammer database"]) {
    assert.ok(!blob.includes(banned), `non-accusatory: must not contain "${banned}"`);
  }
});
