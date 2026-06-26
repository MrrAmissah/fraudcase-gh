import { test } from "node:test";
import assert from "node:assert/strict";
import { runExternalLookups } from "../threatIntelService";
import { ThreatIntelProvider } from "../providers/providerTypes";
import { ExtractedIndicator, ProviderVerdict, VerdictStatus } from "../types";

function ind(
  type: ExtractedIndicator["type"],
  value: string,
  privacyClass: ExtractedIndicator["privacyClass"] = "public",
): ExtractedIndicator {
  return { type, value, normalizedValue: value, confidence: 0.9, privacyClass, domain: type === "url" || type === "domain" ? value : undefined };
}
// fetch that throws — proves the path never reaches the network in tests.
const noNetworkFetch = (async () => {
  throw new Error("no network in tests");
}) as unknown as typeof fetch;
const E = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

function mockProvider(opts: { enabled: boolean; status?: VerdictStatus; calls?: { n: number } }): ThreatIntelProvider {
  return {
    name: "virustotal",
    capabilities: { url: true, domain: true, ip: true, hash: true },
    isConfigured: () => true,
    isEnabled: () => opts.enabled,
    async lookup(): Promise<ProviderVerdict> {
      if (opts.calls) opts.calls.n++;
      return { provider: "virustotal", checkedAt: "t", status: opts.status || "no_match", category: "suspicious", confidence: 0.8, rawScoreSummary: "vt summary", cacheTtlSeconds: 60 };
    },
  };
}
const deps = (providers: ThreatIntelProvider[]) => ({ fetchImpl: noNetworkFetch, providers });

test("external OFF (flag unset) -> not_checked, no provider called", async () => {
  const calls = { n: 0 };
  const r = await runExternalLookups([ind("url", "https://x.xyz")], E({}), deps([mockProvider({ enabled: true, calls })]));
  assert.equal(r.status, "not_checked");
  assert.equal(calls.n, 0);
});

test("external ON but no provider enabled -> unavailable, no call", async () => {
  const calls = { n: 0 };
  const r = await runExternalLookups([ind("url", "https://x.xyz")], E({ THREAT_INTEL_EXTERNAL_LOOKUPS: "true" }), deps([mockProvider({ enabled: false, calls })]));
  assert.equal(r.status, "unavailable");
  assert.equal(calls.n, 0);
});

test("external ON + provider enabled -> dispatched; match propagates", async () => {
  const calls = { n: 0 };
  const r = await runExternalLookups([ind("url", "https://x.xyz")], E({ THREAT_INTEL_EXTERNAL_LOOKUPS: "true" }), deps([mockProvider({ enabled: true, status: "match", calls })]));
  assert.equal(r.status, "match");
  assert.equal(calls.n, 1);
  assert.equal(r.verdictsByIndicator.get("https://x.xyz")?.[0].status, "match");
});

test("external ON + provider enabled, no_match -> no_match (never 'safe')", async () => {
  const r = await runExternalLookups([ind("url", "https://x.xyz")], E({ THREAT_INTEL_EXTERNAL_LOOKUPS: "true" }), deps([mockProvider({ enabled: true, status: "no_match" })]));
  assert.equal(r.status, "no_match");
});

test("do_not_send_external indicators withheld -> nothing checkable -> not_checked, no call", async () => {
  const calls = { n: 0 };
  const r = await runExternalLookups(
    [ind("url", "https://x.com/r?token=s", "do_not_send_external"), ind("phone", "0244***019", "do_not_send_external")],
    E({ THREAT_INTEL_EXTERNAL_LOOKUPS: "true" }),
    deps([mockProvider({ enabled: true, calls })]),
  );
  assert.equal(calls.n, 0);
  assert.equal(r.status, "not_checked");
});
