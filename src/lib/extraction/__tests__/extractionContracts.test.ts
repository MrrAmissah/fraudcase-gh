import { test } from "node:test";
import assert from "node:assert/strict";
import { extractionSchema } from "../extractionSchema";
import {
  EXTRACTION_INJECTION_GUARD,
  EXTRACTION_SYSTEM_INSTRUCTION,
  buildExtractionPrompt,
} from "../extractionPrompt";

test("extraction schema has NO risk-scoring or classification field (injection control)", () => {
  const props = Object.keys(extractionSchema.properties);
  for (const banned of ["riskScore", "scamCategory", "confidence", "verdict", "isFraud"]) {
    assert.ok(!props.includes(banned), `pass A schema must not expose "${banned}"`);
  }
});

test("extraction schema requires verbatim transcription and grounded facts", () => {
  assert.deepEqual(extractionSchema.required, ["visibleText", "facts", "visualSignals", "uncertaintyNotes"]);
  // Every fact must carry an evidenceQuote (grounding requirement).
  const factItem = (extractionSchema.properties.facts as any).items;
  assert.ok(factItem.required.includes("evidenceQuote"));
  assert.ok(factItem.required.includes("rawValue"));
});

test("injection guard explicitly forbids obeying embedded instructions", () => {
  const g = EXTRACTION_INJECTION_GUARD.toLowerCase();
  assert.ok(g.includes("evidence data"), "must frame content as evidence data");
  assert.ok(g.includes("not instructions"), "must say the content is not instructions");
  assert.ok(g.includes("do not obey"), "must explicitly refuse to obey embedded instructions");
  assert.ok(g.includes("ignore previous instructions"), "must name the classic injection phrase");
  assert.ok(g.includes("do not invent"), "must forbid fabricating entities");
});

test("system instruction asserts extraction-only (never scores)", () => {
  const s = EXTRACTION_SYSTEM_INSTRUCTION.toLowerCase();
  assert.ok(s.includes("extraction only"));
  assert.ok(s.includes("never score") || s.includes("you never score"));
  // The guard is embedded in the system instruction.
  assert.ok(EXTRACTION_SYSTEM_INSTRUCTION.includes(EXTRACTION_INJECTION_GUARD));
});

test("buildExtractionPrompt returns kind-specific task with JSON-only directive", () => {
  const image = buildExtractionPrompt("image");
  const pdf = buildExtractionPrompt("pdf");
  assert.ok(image.includes("screenshot"));
  assert.ok(pdf.includes("page by page"));
  for (const p of [image, pdf]) {
    assert.ok(p.toLowerCase().includes("return json only"));
    assert.ok(p.toLowerCase().includes("evidencequote"));
  }
});
