import { test } from "node:test";
import assert from "node:assert/strict";
import { abuseIpdbProviderStub, urlscanProviderStub } from "../providers/futureProviders";
import { ProviderLookupContext } from "../providers/providerTypes";

const noNetworkFetch = (async () => {
  throw new Error("no network — stub must not call out");
}) as unknown as typeof fetch;
const ctx: ProviderLookupContext = { fetchImpl: noNetworkFetch, timeoutMs: 1000, env: {} as NodeJS.ProcessEnv };
const anyEnv = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

test("stub providers are permanently disabled (even with a flag/key set)", () => {
  for (const p of [abuseIpdbProviderStub, urlscanProviderStub]) {
    assert.equal(p.isConfigured(anyEnv({ ABUSEIPDB_API_KEY: "k", URLSCAN_API_KEY: "k" })), false);
    assert.equal(p.isEnabled(anyEnv({ THREAT_INTEL_ABUSEIPDB_ENABLED: "true", THREAT_INTEL_URLSCAN_ENABLED: "true" })), false);
  }
});

test("stub lookups return an unavailable verdict and never touch the network", async () => {
  const a = await abuseIpdbProviderStub.lookup("ip", "1.2.3.4", ctx);
  assert.equal(a.status, "unknown");
  assert.match(a.rawScoreSummary || "", /not implemented/);
  const u = await urlscanProviderStub.lookup("url", "https://x.xyz", ctx);
  assert.equal(u.status, "unknown");
  assert.match(u.rawScoreSummary || "", /not implemented/);
});
