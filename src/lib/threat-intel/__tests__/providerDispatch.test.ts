import { test } from "node:test";
import assert from "node:assert/strict";
import { dispatchProviderLookups } from "../providerDispatch";
import { ThreatIntelProvider, ProviderLookupContext } from "../providers/providerTypes";
import { createMemoryCache } from "../reputationCache";
import { ExtractedIndicator, ProviderVerdict } from "../types";

function ind(
  type: ExtractedIndicator["type"],
  value: string,
  privacyClass: ExtractedIndicator["privacyClass"] = "public",
): ExtractedIndicator {
  return {
    type,
    value,
    normalizedValue: value,
    confidence: 0.9,
    privacyClass,
    domain: type === "domain" || type === "url" ? value : undefined,
  };
}

function mockProvider(opts: { enabled: boolean; calls?: { n: number }; throws?: boolean }): ThreatIntelProvider {
  return {
    name: "safe_browsing",
    capabilities: { url: true, domain: true, ip: false, hash: false },
    isConfigured: () => true,
    isEnabled: () => opts.enabled,
    async lookup(): Promise<ProviderVerdict> {
      if (opts.calls) opts.calls.n++;
      if (opts.throws) throw new Error("HTTP 429 rate limit");
      return { provider: "safe_browsing", checkedAt: "t", status: "no_match", category: "unknown", confidence: 0.3, cacheTtlSeconds: 60 };
    },
  };
}

// fetch that throws — proves providers in tests cannot reach the network unmocked.
const noNetworkFetch = (async () => {
  throw new Error("no network in tests");
}) as unknown as typeof fetch;
const ctx = (): ProviderLookupContext => ({ fetchImpl: noNetworkFetch, timeoutMs: 1000, env: {} as NodeJS.ProcessEnv });

test("dispatch: disabled provider is never called", async () => {
  const calls = { n: 0 };
  const r = await dispatchProviderLookups([ind("url", "https://x.xyz")], [mockProvider({ enabled: false, calls })], ctx());
  assert.equal(calls.n, 0);
  assert.equal(r.verdictsByIndicator.size, 0);
});

test("dispatch: do_not_send_external indicators are skipped (privacy guard at dispatch)", async () => {
  const calls = { n: 0 };
  const r = await dispatchProviderLookups(
    [ind("url", "https://x.com/r?token=s", "do_not_send_external")],
    [mockProvider({ enabled: true, calls })],
    ctx(),
  );
  assert.equal(calls.n, 0);
  assert.equal(r.skippedForPrivacy.length, 1);
});

test("dispatch: enabled provider verdicts URL; phone is never sent", async () => {
  const calls = { n: 0 };
  const r = await dispatchProviderLookups(
    [ind("url", "https://x.xyz"), ind("phone", "0244***019", "do_not_send_external")],
    [mockProvider({ enabled: true, calls })],
    ctx(),
  );
  assert.equal(calls.n, 1);
  assert.equal(r.verdictsByIndicator.get("https://x.xyz")?.[0].status, "no_match");
});

test("dispatch: provider errors normalize to a safe verdict (rate_limited), never throw", async () => {
  const r = await dispatchProviderLookups([ind("url", "https://x.xyz")], [mockProvider({ enabled: true, throws: true })], ctx());
  assert.equal(r.verdictsByIndicator.get("https://x.xyz")?.[0].status, "rate_limited");
});

test("dispatch: cache-first — provider invoked once across two runs", async () => {
  const calls = { n: 0 };
  const cache = createMemoryCache(() => 1000);
  const provider = mockProvider({ enabled: true, calls });
  const inds = [ind("url", "https://x.xyz")];
  await dispatchProviderLookups(inds, [provider], ctx(), cache);
  await dispatchProviderLookups(inds, [provider], ctx(), cache);
  assert.equal(calls.n, 1);
});
