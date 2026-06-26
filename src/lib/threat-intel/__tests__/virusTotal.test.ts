import { test } from "node:test";
import assert from "node:assert/strict";
import { virusTotalProvider } from "../providers/virusTotalProvider";
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

test("virustotal: disabled by default; enabled only with flag + key", () => {
  assert.equal(virusTotalProvider.isEnabled(E({})), false);
  assert.equal(virusTotalProvider.isEnabled(E({ THREAT_INTEL_VIRUSTOTAL_ENABLED: "true" })), false);
  assert.equal(virusTotalProvider.isEnabled(E({ THREAT_INTEL_VIRUSTOTAL_ENABLED: "true", VIRUSTOTAL_API_KEY: "k" })), true);
});

test("virustotal: missing key -> unavailable, no network call", async () => {
  const calls = { n: 0 };
  const rec: Rec = {};
  const v = await virusTotalProvider.lookup("url", "https://x.xyz", ctx({}, recordingFetch(200, {}, rec, calls)));
  assert.equal(v.status, "unknown");
  assert.equal(calls.n, 0);
});

test("virustotal: only PASSIVE GET is used (no submit/upload), with x-apikey header", async () => {
  const rec: Rec = {};
  await virusTotalProvider.lookup(
    "url",
    "https://bad.xyz/login",
    ctx({ VIRUSTOTAL_API_KEY: "k" }, recordingFetch(200, { data: { attributes: { last_analysis_stats: { malicious: 3, suspicious: 1 } } } }, rec)),
  );
  assert.equal(rec.method, "GET");
  assert.ok(rec.url?.includes("/api/v3/urls/"), "must hit the passive URL report endpoint");
  assert.ok(!/\/urls$/.test(rec.url || ""), "must NOT hit the submit endpoint");
  assert.equal(rec.headers?.["x-apikey"], "k");
});

test("virustotal: detections -> match (non-accusatory), not 'confirmed fraud'", async () => {
  const rec: Rec = {};
  const v = await virusTotalProvider.lookup(
    "domain",
    "bad.xyz",
    ctx({ VIRUSTOTAL_API_KEY: "k" }, recordingFetch(200, { data: { attributes: { last_analysis_stats: { malicious: 5, suspicious: 0 } } } }, rec)),
  );
  assert.equal(v.status, "match");
  assert.ok((v.rawScoreSummary || "").toLowerCase().includes("malicious"));
  assert.ok(!/confirmed (fraud|scam)|scammer|criminal/i.test(v.rawScoreSummary || ""));
});

test("virustotal: 404 and zero detections both map to no_match, never 'safe'", async () => {
  const rec: Rec = {};
  const notFound = await virusTotalProvider.lookup("ip", "1.2.3.4", ctx({ VIRUSTOTAL_API_KEY: "k" }, recordingFetch(404, {}, rec)));
  assert.equal(notFound.status, "no_match");
  const zero = await virusTotalProvider.lookup("hash", "abc123", ctx({ VIRUSTOTAL_API_KEY: "k" }, recordingFetch(200, { data: { attributes: { last_analysis_stats: { malicious: 0, suspicious: 0 } } } }, rec)));
  assert.equal(zero.status, "no_match");
  assert.ok(!/\b(safe|clean)\b/i.test((notFound.rawScoreSummary || "") + (zero.rawScoreSummary || "")));
});

test("virustotal: server error -> error verdict, never throws", async () => {
  const rec: Rec = {};
  const v = await virusTotalProvider.lookup("url", "https://x.xyz", ctx({ VIRUSTOTAL_API_KEY: "k" }, recordingFetch(500, {}, rec)));
  assert.ok(["error", "rate_limited"].includes(v.status));
});
