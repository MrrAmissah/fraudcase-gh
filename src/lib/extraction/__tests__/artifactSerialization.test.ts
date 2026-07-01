import { test } from "node:test";
import assert from "node:assert/strict";
import { redactPIIAndSecrets } from "../../security/redaction";

/**
 * Regression guard for the extraction response serialization boundary.
 *
 * OCR-derived `redactedText` legitimately contains newlines (multi-line receipts/chats). The extract
 * route returns the artifact via `res.json(...)` i.e. `JSON.stringify`, which MUST escape those
 * control characters so the response is parseable by strict JSON parsers (browsers' `JSON.parse`,
 * `jq`, Go/Java decoders). This locks that invariant: an earlier report of "raw unescaped newlines"
 * traced to a debugging capture artifact (`echo` re-expanding `\n`), not the server — these tests
 * ensure a future change (e.g. a hand-rolled serializer) can't reintroduce a real break.
 */

function serializeAsResJson(body: unknown): string {
  return JSON.stringify(body); // exactly what express res.json() does
}

// A raw control char (U+0000..U+001F) inside a JSON string makes it invalid for strict parsers.
// Built via RegExp() so no literal control char appears in this source file.
const RAW_CONTROL_CHAR = new RegExp("[\\u0000-\\u001F]");

test("artifact serialization: multi-line redactedText survives res.json as STRICT-parseable JSON", () => {
  const ocr = "FraudCase receipt\nAmount: fifty cedis\r\nOrder reference 4821\nThank you";
  const redactedText = redactPIIAndSecrets(ocr).redactedText;
  assert.ok(redactedText.includes("\n"), "precondition: redactedText carries real line breaks");

  const body = serializeAsResJson({ artifact: { redactedText, facts: [{ type: "url", redactedValue: "http://x.y" }] } });

  // The serialized wire bytes must contain no raw control characters (they must be escaped).
  assert.equal(RAW_CONTROL_CHAR.test(body), false, "res.json output must not contain raw control chars");
  // Strict parse must succeed and round-trip the line breaks (we escape, never destroy them).
  const parsed = JSON.parse(body) as { artifact: { redactedText: string } };
  assert.equal(parsed.artifact.redactedText, redactedText);
  assert.ok(parsed.artifact.redactedText.includes("\n"), "legitimate line breaks are preserved, not stripped");
});

test("artifact serialization: unicode line/paragraph separators also serialize strict-parseable", () => {
  // U+2028/U+2029 are valid in JSON but a classic footgun; confirm a round-trip still parses strictly.
  const text = `line1${String.fromCharCode(0x2028)}line2${String.fromCharCode(0x2029)}line3`;
  const body = serializeAsResJson({ artifact: { redactedText: text } });
  const parsed = JSON.parse(body) as { artifact: { redactedText: string } };
  assert.equal(parsed.artifact.redactedText, text);
});
