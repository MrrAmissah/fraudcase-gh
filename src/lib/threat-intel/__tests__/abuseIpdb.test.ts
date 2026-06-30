import { test } from "node:test";
import assert from "node:assert/strict";
import { abuseIpdbProvider } from "../providers/abuseIpdbProvider";
import { ProviderLookupContext } from "../providers/providerTypes";

interface Rec { url?: string; method?: string; headers?: Record<string, string> }
function recordingFetch(status: number, body: unknown, rec: Rec, calls?: { n: number }): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    if (calls) calls.n++;
    rec.url = String(url);
    rec.method = (init?.method || "GET").toUpperCase();
    rec.headers = (init?.headers as Record<string, string>) || {};
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
  }) as unknown as typeof fetch;
}
function ctx(env: Record<string, string>, fetchImpl: typeof fetch): ProviderLookupContext {
  return { fetchImpl, timeoutMs: 1000, env: env as unknown as NodeJS.ProcessEnv };
}
const E = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

test("abuseipdb: disabled by default; enabled only with flag + key", () => {
  assert.equal(abuseIpdbProvider.isEnabled(E({})), false);
  assert.equal(abuseIpdbProvider.isEnabled(E({ THREAT_INTEL_ABUSEIPDB_ENABLED: "true" })), false);
  assert.equal(abuseIpdbProvider.isEnabled(E({ THREAT_INTEL_ABUSEIPDB_ENABLED: "true", ABUSEIPDB_API_KEY: "k" })), true);
});

test("abuseipdb: missing key -> unavailable, no network call", async () => {
  const calls = { n: 0 };
  const rec: Rec = {};
  const v = await abuseIpdbProvider.lookup("ip", "8.8.8.8", ctx({}, recordingFetch(200, {}, rec, calls)));
  assert.equal(v.status, "unknown");
  assert.equal(calls.n, 0);
});

test("abuseipdb: CHECK endpoint only (GET /api/v2/check, never /report), with Key header", async () => {
  const rec: Rec = {};
  await abuseIpdbProvider.lookup("ip", "8.8.8.8", ctx({ ABUSEIPDB_API_KEY: "k" }, recordingFetch(200, { data: { abuseConfidenceScore: 0 } }, rec)));
  assert.equal(rec.method, "GET");
  assert.ok(rec.url?.includes("/api/v2/check"), "must hit the check endpoint");
  assert.ok(!/\/report/.test(rec.url || ""), "must NEVER hit the report endpoint");
  assert.equal(rec.headers?.["Key"], "k");
});

test("abuseipdb: high confidence -> match (non-accusatory), not 'confirmed fraud'", async () => {
  const rec: Rec = {};
  const v = await abuseIpdbProvider.lookup("ip", "8.8.8.8", ctx({ ABUSEIPDB_API_KEY: "k" }, recordingFetch(200, { data: { abuseConfidenceScore: 90, totalReports: 12 } }, rec)));
  assert.equal(v.status, "match");
  assert.ok((v.rawScoreSummary || "").toLowerCase().includes("confidence"));
  assert.ok(!/confirmed (fraud|scam)|scammer|criminal/i.test(v.rawScoreSummary || ""));
});

test("abuseipdb: low/zero confidence -> no_match, never 'safe'", async () => {
  const rec: Rec = {};
  const v = await abuseIpdbProvider.lookup("ip", "8.8.8.8", ctx({ ABUSEIPDB_API_KEY: "k" }, recordingFetch(200, { data: { abuseConfidenceScore: 3, totalReports: 1 } }, rec)));
  assert.equal(v.status, "no_match");
  assert.ok(!/\b(safe|clean)\b/i.test(v.rawScoreSummary || ""));
});

test("abuseipdb: non-ip kind -> unavailable; server error -> error verdict (never throws)", async () => {
  const rec: Rec = {};
  const wrong = await abuseIpdbProvider.lookup("url", "https://x.xyz", ctx({ ABUSEIPDB_API_KEY: "k" }, recordingFetch(200, {}, rec)));
  assert.equal(wrong.status, "unknown");
  const err = await abuseIpdbProvider.lookup("ip", "8.8.8.8", ctx({ ABUSEIPDB_API_KEY: "k" }, recordingFetch(500, {}, rec)));
  assert.ok(["error", "rate_limited"].includes(err.status));
});
