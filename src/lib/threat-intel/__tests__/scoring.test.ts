import { test } from "node:test";
import assert from "node:assert/strict";
import { localHeuristicsVerdict } from "../providers/localHeuristicsProvider";
import { aggregateVerdicts, riskLabelFromSignals, userFacingSummary } from "../threatIntelScoring";
import { ExtractedIndicator, ProviderVerdict, ThreatIntelSignal, FORBIDDEN_PHRASES } from "../types";

function urlInd(domain: string, tld: string): ExtractedIndicator {
  return { type: "domain", value: domain, normalizedValue: domain, confidence: 0.9, privacyClass: "public", domain, tld };
}

test("local heuristics: official allowlist is benign, lookalike is suspicious", () => {
  const official = localHeuristicsVerdict(urlInd("mtn.com.gh", "gh"));
  assert.equal(official?.status, "no_match");
  assert.equal(official?.category, "benign");

  const lookalike = localHeuristicsVerdict(urlInd("mtn-momo-verify.xyz", "xyz"));
  assert.equal(lookalike?.status, "match");
  assert.equal(lookalike?.category, "suspicious");
  assert.ok((lookalike?.confidence ?? 0) > 0.3);
});

test("local heuristics: shortener flagged; clean domain no_match; phones unhandled", () => {
  assert.equal(localHeuristicsVerdict(urlInd("bit.ly", "ly"))?.status, "match");
  assert.equal(localHeuristicsVerdict(urlInd("example.com", "com"))?.status, "no_match");
  assert.equal(localHeuristicsVerdict({ type: "phone", value: "0244***019", normalizedValue: "0244***019", confidence: 0.7, privacyClass: "do_not_send_external" }), null);
});

test("aggregateVerdicts: handles match/no_match/unknown/error/rate_limited", () => {
  assert.equal(aggregateVerdicts([]), "unknown");
  const v = (status: ProviderVerdict["status"], confidence = 0.5): ProviderVerdict => ({
    provider: "local_heuristics", checkedAt: "t", status, category: "suspicious", confidence, cacheTtlSeconds: 60,
  });
  assert.equal(aggregateVerdicts([v("no_match")]), "no_match_found");
  assert.equal(aggregateVerdicts([v("error")]), "unknown");
  assert.equal(aggregateVerdicts([v("rate_limited")]), "unknown");
  assert.equal(aggregateVerdicts([v("match", 0.4)]), "needs_verification");
  assert.equal(aggregateVerdicts([v("match", 0.7)]), "possible_match");
  assert.equal(aggregateVerdicts([v("match", 0.4), v("match", 0.4)]), "possible_match");
});

test("risk label scales with signal strength", () => {
  const sig = (s: ThreatIntelSignal["aggregateStatus"], host = "x.xyz"): ThreatIntelSignal => ({ indicator: urlInd(host, "xyz"), verdicts: [], aggregateStatus: s });
  assert.equal(riskLabelFromSignals([]).label, "low");
  assert.equal(riskLabelFromSignals([sig("needs_verification")]).label, "caution");
  assert.equal(riskLabelFromSignals([sig("possible_match")]).label, "elevated");
  // two DISTINCT hosts -> 0.8 -> critical
  assert.equal(riskLabelFromSignals([sig("possible_match", "a.xyz"), sig("possible_match", "b.xyz")]).label, "critical");
});

test("risk scoring de-duplicates a url + its derived domain (same host counts once)", () => {
  const urlSig: ThreatIntelSignal = { indicator: { type: "url", value: "https://mtn-verify.xyz/login", normalizedValue: "https://mtn-verify.xyz/login", confidence: 0.9, privacyClass: "public", domain: "mtn-verify.xyz", tld: "xyz" }, verdicts: [], aggregateStatus: "possible_match" };
  const domSig: ThreatIntelSignal = { indicator: urlInd("mtn-verify.xyz", "xyz"), verdicts: [], aggregateStatus: "possible_match" };
  // both describe the same host -> counted once (0.4 -> elevated), not twice (would be critical)
  assert.equal(riskLabelFromSignals([urlSig, domSig]).label, "elevated");
});

test("user-facing summary is non-accusatory; no-match language is safe", () => {
  const none = userFacingSummary([]);
  assert.match(none, /No local indicators detected/i);
  assert.ok(!/\b(safe|clean)\b/i.test(none), 'no-match must not say "safe"/"clean"');

  const flagged = userFacingSummary([{ indicator: urlInd("x.xyz", "xyz"), verdicts: [], aggregateStatus: "possible_match" }]);
  for (const p of FORBIDDEN_PHRASES) assert.ok(!flagged.toLowerCase().includes(p), `must not say "${p}"`);
  assert.ok(!/\b(safe|clean)\b/i.test(flagged), 'must not say "safe"/"clean"');
  assert.match(flagged, /possible match|needs verification/i);
});
