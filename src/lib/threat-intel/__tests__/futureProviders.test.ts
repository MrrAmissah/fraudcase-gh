import { test } from "node:test";
import assert from "node:assert/strict";
import { urlscanProviderStub } from "../providers/futureProviders";
import { ProviderLookupContext } from "../providers/providerTypes";

const noNetworkFetch = (async () => {
  throw new Error("no network — stub must not call out");
}) as unknown as typeof fetch;
const ctx: ProviderLookupContext = { fetchImpl: noNetworkFetch, timeoutMs: 1000, env: {} as NodeJS.ProcessEnv };
const anyEnv = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

test("urlscan stub is permanently disabled (even with a flag/key set)", () => {
  assert.equal(urlscanProviderStub.isConfigured(anyEnv({ URLSCAN_API_KEY: "k" })), false);
  assert.equal(urlscanProviderStub.isEnabled(anyEnv({ THREAT_INTEL_URLSCAN_ENABLED: "true" })), false);
});

test("urlscan stub lookup returns unavailable and never touches the network", async () => {
  const u = await urlscanProviderStub.lookup("url", "https://x.xyz", ctx);
  assert.equal(u.status, "unknown");
  assert.match(u.rawScoreSummary || "", /not implemented/);
});
