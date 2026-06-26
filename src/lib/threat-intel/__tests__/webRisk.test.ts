import { test } from "node:test";
import assert from "node:assert/strict";
import { webRiskProvider } from "../providers/webRiskProvider";
import { ProviderLookupContext } from "../providers/providerTypes";

function mockFetch(status: number, body: unknown, calls?: { n: number }): typeof fetch {
  return (async () => {
    if (calls) calls.n++;
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
  }) as unknown as typeof fetch;
}
function ctx(env: Record<string, string>, fetchImpl: typeof fetch): ProviderLookupContext {
  return { fetchImpl, timeoutMs: 1000, env: env as unknown as NodeJS.ProcessEnv };
}
const E = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

test("web risk: disabled by default; enabled only with flag + key", () => {
  assert.equal(webRiskProvider.isEnabled(E({})), false);
  assert.equal(webRiskProvider.isEnabled(E({ THREAT_INTEL_WEB_RISK_ENABLED: "true" })), false); // no key
  assert.equal(webRiskProvider.isConfigured(E({ GOOGLE_WEB_RISK_API_KEY: "k" })), true);
  assert.equal(webRiskProvider.isEnabled(E({ THREAT_INTEL_WEB_RISK_ENABLED: "true", GOOGLE_WEB_RISK_API_KEY: "k" })), true);
});

test("web risk: missing key -> unavailable, no network call", async () => {
  const calls = { n: 0 };
  const v = await webRiskProvider.lookup("url", "https://x.xyz", ctx({}, mockFetch(200, {}, calls)));
  assert.equal(v.status, "unknown");
  assert.match(v.rawScoreSummary || "", /not configured/);
  assert.equal(calls.n, 0);
});

test("web risk: threat response -> non-accusatory match + ttl from expireTime", async () => {
  const expire = new Date(Date.now() + 7200_000).toISOString();
  const v = await webRiskProvider.lookup(
    "url",
    "https://bad.xyz",
    ctx({ GOOGLE_WEB_RISK_API_KEY: "k" }, mockFetch(200, { threat: { threatTypes: ["SOCIAL_ENGINEERING"], expireTime: expire } })),
  );
  assert.equal(v.status, "match");
  assert.equal(v.category, "social_engineering");
  assert.ok(v.cacheTtlSeconds > 3000 && v.cacheTtlSeconds <= 7200);
  assert.ok(!/\b(safe|clean)\b/i.test(v.rawScoreSummary || ""));
});

test("web risk: empty response -> no_match, never 'safe'", async () => {
  const v = await webRiskProvider.lookup("url", "https://x.xyz", ctx({ GOOGLE_WEB_RISK_API_KEY: "k" }, mockFetch(200, {})));
  assert.equal(v.status, "no_match");
  assert.ok(!/\b(safe|clean)\b/i.test(v.rawScoreSummary || ""));
});

test("web risk: HTTP 429 -> rate_limited verdict, never throws", async () => {
  const v = await webRiskProvider.lookup("url", "https://x.xyz", ctx({ GOOGLE_WEB_RISK_API_KEY: "k" }, mockFetch(429, {})));
  assert.ok(["error", "rate_limited"].includes(v.status));
});

test("web risk: non-url kind -> unavailable", async () => {
  const v = await webRiskProvider.lookup("ip", "1.2.3.4", ctx({ GOOGLE_WEB_RISK_API_KEY: "k" }, mockFetch(200, {})));
  assert.equal(v.status, "unknown");
});
