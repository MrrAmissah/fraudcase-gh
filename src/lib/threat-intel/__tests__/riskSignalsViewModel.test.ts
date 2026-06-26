import { test } from "node:test";
import assert from "node:assert/strict";
import { enrichThreatIntel } from "../threatIntelService";
import { buildRiskSignalsViewModel } from "../riskSignalsViewModel";
import { FORBIDDEN_PHRASES } from "../types";

test("view-model: local match -> Local indicator; external defaults to 'Not checked'", () => {
  const vm = buildRiskSignalsViewModel(
    enrichThreatIntel({ text: "https://gh-post-clearance.xyz/fee" }),
    { enabled: true, externalStatus: "not_checked", now: () => "T" },
  );
  assert.equal(vm.enabled, true);
  assert.ok(vm.localIndicators.length >= 1);
  const li = vm.localIndicators.find((s) => s.id.startsWith("local-url") || s.id.startsWith("local-domain"));
  assert.ok(li);
  assert.equal(li.sourceType, "local_heuristic");
  assert.ok(li.safeDisplayValue.includes("gh-post-clearance.xyz"));
  assert.ok(li.explanation.length > 0);
  assert.equal(vm.external.status, "not_checked");
  assert.equal(vm.external.label, "Not checked");
  assert.deepEqual(vm.external.signals, []);
  assert.equal(vm.generatedAt, "T");
});

test("view-model: do_not_send_external indicator surfaces a local-only marker without the secret", () => {
  const vm = buildRiskSignalsViewModel(
    enrichThreatIntel({ text: "reset https://example.com/r?token=SECRET and call 0244***019" }),
  );
  const markers = vm.localIndicators.filter((s) => s.id.startsWith("local-dnse-"));
  assert.ok(markers.length >= 1);
  assert.ok(markers.every((m) => !m.safeDisplayValue.includes("SECRET")));
  assert.match(markers[0].explanation, /never sent to external providers/i);
});

test("view-model: no banned wording anywhere (incl. whole-word safe/clean)", () => {
  const blob = JSON.stringify(buildRiskSignalsViewModel(enrichThreatIntel({ text: "https://mtn-verify.tk/login" })));
  for (const p of FORBIDDEN_PHRASES) assert.ok(!blob.toLowerCase().includes(p), `must not contain "${p}"`);
  assert.ok(!/\b(safe|clean)\b/i.test(blob), 'must not say "safe"/"clean"');
});

test("view-model: benign input -> empty local indicators, external still 'Not checked'", () => {
  const vm = buildRiskSignalsViewModel(enrichThreatIntel({ text: "thanks for the help" }));
  assert.deepEqual(vm.localIndicators, []);
  assert.equal(vm.external.label, "Not checked");
});
