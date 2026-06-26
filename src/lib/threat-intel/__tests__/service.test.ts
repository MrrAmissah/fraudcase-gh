import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isThreatIntelEnabled,
  isThreatIntelExternalEnabled,
  enrichThreatIntel,
} from "../threatIntelService";
import { createMemoryCache, cacheKey } from "../reputationCache";
import { FORBIDDEN_PHRASES, ProviderVerdict } from "../types";

test("feature flags default OFF; only literal 'true' enables", () => {
  assert.equal(isThreatIntelEnabled({} as NodeJS.ProcessEnv), false);
  assert.equal(isThreatIntelEnabled({ THREAT_INTEL_ENABLED: "false" } as unknown as NodeJS.ProcessEnv), false);
  assert.equal(isThreatIntelEnabled({ THREAT_INTEL_ENABLED: "true" } as unknown as NodeJS.ProcessEnv), true);
  assert.equal(isThreatIntelExternalEnabled({} as NodeJS.ProcessEnv), false);
});

test("enrich on scam-like redacted text: flags lookalike, withholds token URL + phone from external", () => {
  const text = "URGENT: pay GHS 12.50 at https://gh-post-clearance.xyz/fee . Reset https://example.com/r?token=ABC . Call 0244***019";
  const r = enrichThreatIntel({ text, sourceEvidenceId: "ev-1" });

  // the lookalike .xyz domain should surface as a signal needing verification
  const flagged = r.signals.filter((s) => s.aggregateStatus === "possible_match" || s.aggregateStatus === "needs_verification");
  assert.ok(flagged.length >= 1);
  assert.ok(["caution", "elevated", "high", "critical"].includes(r.riskLabel));

  // token URL and phone must be withheld from external providers
  assert.ok(r.privacyWarnings.some((w) => w.includes("token") || w.toLowerCase().includes("pii")));
  assert.ok(r.privacyWarnings.length >= 1);
});

test("output never contains forbidden/accusatory wording", () => {
  const r = enrichThreatIntel({ text: "https://mtn-verify-momo.tk/login and https://bit.ly/abc" });
  const blob = `${r.userFacingSummary}\n${r.analysisNotesForModel}\n${r.privacyWarnings.join("\n")}`.toLowerCase();
  for (const p of FORBIDDEN_PHRASES) assert.ok(!blob.includes(p), `output must not contain "${p}"`);
});

test("clean input degrades gracefully (no signals, low risk, safe no-match wording)", () => {
  const r = enrichThreatIntel({ text: "Thanks for your help yesterday." });
  assert.equal(r.indicators.length, 0);
  assert.equal(r.riskLabel, "low");
  assert.equal(r.riskContribution, 0);
  assert.match(r.userFacingSummary, /does not mean this is safe/i);
});

test("enrich never throws on empty/garbage input", () => {
  assert.doesNotThrow(() => enrichThreatIntel({ text: "" }));
  // @ts-expect-error intentional bad input
  assert.doesNotThrow(() => enrichThreatIntel({}));
});

test("reputation cache: set/get + TTL expiry with injected clock", () => {
  let t = 1_000_000;
  const cache = createMemoryCache(() => t);
  const verdict: ProviderVerdict = {
    provider: "local_heuristics", checkedAt: "x", status: "match", category: "suspicious",
    confidence: 0.5, cacheTtlSeconds: 60,
  };
  const k = cacheKey("local_heuristics", "example.xyz");
  cache.set(k, verdict);
  assert.equal(cache.get(k)?.status, "match");
  assert.equal(cache.size(), 1);
  t += 61_000; // past TTL
  assert.equal(cache.get(k), undefined);
  assert.equal(cache.size(), 0);
});
