import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractVisualEvidence,
  isMultimodalExtractionEnabled,
} from "../multimodalExtractor";

const EXTRACT_JSON = JSON.stringify({
  visibleText: "MTN MoMo received GHS 1,500.00. Contact 0542385934 for reversal.",
  languageHint: "en",
  facts: [
    { type: "amount", rawValue: "GHS 1,500.00", evidenceQuote: "received GHS 1,500.00" },
    { type: "phone_number", rawValue: "0542385934", evidenceQuote: "Contact 0542385934" },
    { type: "definitely_not_a_type", rawValue: "x", evidenceQuote: "x" }, // dropped by sanitizer
  ],
  visualSignals: [{ signalType: "request_for_reversal", description: "asks for reversal", severity: "high" }],
  uncertaintyNotes: ["cropped header"],
});

const okClient = { models: { generateContent: async () => ({ text: EXTRACT_JSON }) } };
const img = { buffer: Buffer.from("fakebytes"), mimeType: "image/png", kind: "image" as const };

test("flag is OFF unless MULTIMODAL_EXTRACTION_ENABLED === 'true'", () => {
  const prev = process.env.MULTIMODAL_EXTRACTION_ENABLED;
  try {
    delete process.env.MULTIMODAL_EXTRACTION_ENABLED;
    assert.equal(isMultimodalExtractionEnabled(), false);
    process.env.MULTIMODAL_EXTRACTION_ENABLED = "1";
    assert.equal(isMultimodalExtractionEnabled(), false, "only the literal 'true' enables");
    process.env.MULTIMODAL_EXTRACTION_ENABLED = "true";
    assert.equal(isMultimodalExtractionEnabled(), true);
  } finally {
    if (prev === undefined) delete process.env.MULTIMODAL_EXTRACTION_ENABLED;
    else process.env.MULTIMODAL_EXTRACTION_ENABLED = prev;
  }
});

test("extractVisualEvidence: maps model output and drops invalid facts", async () => {
  const out = await extractVisualEvidence(img, { client: okClient as any });
  assert.equal(out.status, "succeeded");
  assert.equal(out.raw.provider, "gemini_inline_image");
  assert.equal(out.raw.facts.length, 2, "the invalid fact type is dropped");
  assert.equal(out.raw.visualSignals.length, 1);
  assert.equal(out.raw.languageHint, "en");
});

test("extractVisualEvidence: pdf kind tags the pdf provider", async () => {
  const out = await extractVisualEvidence(
    { buffer: Buffer.from("%PDF-"), mimeType: "application/pdf", kind: "pdf" },
    { client: okClient as any },
  );
  assert.equal(out.raw.provider, "gemini_inline_pdf");
});

test("extractVisualEvidence: client null is a calm no-op (provider none)", async () => {
  const out = await extractVisualEvidence(img, { client: null });
  assert.equal(out.status, "skipped");
  assert.equal(out.raw.provider, "none");
  assert.deepEqual(out.raw.facts, []);
});

test("extractVisualEvidence: slow model yields a timeout outcome", async () => {
  const slow = {
    models: {
      generateContent: () =>
        new Promise<{ text?: string }>((resolve) => setTimeout(() => resolve({ text: EXTRACT_JSON }), 120)),
    },
  };
  const out = await extractVisualEvidence(img, { client: slow as any, timeoutMs: 20 });
  assert.equal(out.status, "timeout");
  assert.equal(out.raw.provider, "none");
});

test("extractVisualEvidence: model error yields a failed outcome with a safe errorType", async () => {
  const boom = {
    models: {
      generateContent: async () => {
        throw new Error("upstream exploded");
      },
    },
  };
  const out = await extractVisualEvidence(img, { client: boom as any });
  assert.equal(out.status, "failed");
  assert.ok(out.errorType && !out.errorType.includes("exploded"), "errorType is a name/code, never the message");
});

test("extractVisualEvidence: logs counts only, never the transcribed content", async () => {
  const marker = "SECRET-OCR-0241234567";
  const leaky = { models: { generateContent: async () => ({ text: JSON.stringify({ visibleText: marker, facts: [], visualSignals: [], uncertaintyNotes: [] }) }) } };
  const lines: string[] = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const sink = (...a: unknown[]) => lines.push(a.map(String).join(" "));
  console.log = sink as typeof console.log;
  console.warn = sink as typeof console.warn;
  try {
    const out = await extractVisualEvidence(img, { client: leaky as any });
    assert.equal(out.status, "succeeded");
  } finally {
    console.log = origLog;
    console.warn = origWarn;
  }
  const joined = lines.join("\n");
  assert.ok(joined.includes("multimodal_extract_ok"), "expected a structured success event");
  assert.ok(!joined.includes(marker), "structured logs must never contain transcribed OCR text");
});
