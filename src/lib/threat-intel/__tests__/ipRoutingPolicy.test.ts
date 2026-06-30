import { test } from "node:test";
import assert from "node:assert/strict";
import { dispatchProviderLookups } from "../providerDispatch";
import { virusTotalProvider } from "../providers/virusTotalProvider";
import { abuseIpdbProvider } from "../providers/abuseIpdbProvider";
import { ProviderLookupContext } from "../providers/providerTypes";
import { ExtractedIndicator } from "../types";

function ipInd(ip: string): ExtractedIndicator {
  return { type: "ip", value: ip, normalizedValue: ip, confidence: 0.8, privacyClass: "public" };
}
// Records every URL hit so we can assert which provider endpoints were (not) called.
function recordingFetch(rec: { urls: string[] }): typeof fetch {
  return (async (url: string) => {
    rec.urls.push(String(url));
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: { abuseConfidenceScore: 0, attributes: { last_analysis_stats: { malicious: 0 } } } }),
    } as Response;
  }) as unknown as typeof fetch;
}
function ctx(env: Record<string, string>, fetchImpl: typeof fetch): ProviderLookupContext {
  return { fetchImpl, timeoutMs: 1000, env: env as unknown as NodeJS.ProcessEnv };
}
const providers = [virusTotalProvider, abuseIpdbProvider];

test("IP routing: VirusTotal enabled + AbuseIPDB off -> IP is NOT sent to VirusTotal (no calls)", async () => {
  const rec = { urls: [] as string[] };
  const env = { THREAT_INTEL_EXTERNAL_LOOKUPS: "true", THREAT_INTEL_VIRUSTOTAL_ENABLED: "true", VIRUSTOTAL_API_KEY: "k" };
  const r = await dispatchProviderLookups([ipInd("8.8.8.8")], providers, ctx(env, recordingFetch(rec)));
  assert.equal(rec.urls.length, 0, "VirusTotal must not be called for an IP by default");
  assert.equal(r.verdictsByIndicator.size, 0);
});

test("IP routing: AbuseIPDB enabled -> IP eligible for AbuseIPDB check endpoint only", async () => {
  const rec = { urls: [] as string[] };
  const env = { THREAT_INTEL_EXTERNAL_LOOKUPS: "true", THREAT_INTEL_ABUSEIPDB_ENABLED: "true", ABUSEIPDB_API_KEY: "k" };
  const r = await dispatchProviderLookups([ipInd("8.8.8.8")], providers, ctx(env, recordingFetch(rec)));
  assert.ok(rec.urls.some((u) => u.includes("api.abuseipdb.com/api/v2/check")), "AbuseIPDB check endpoint used");
  assert.ok(!rec.urls.some((u) => u.includes("virustotal")), "VirusTotal not called for the IP");
  assert.ok(!rec.urls.some((u) => /\/report/.test(u)), "no report endpoint used");
  assert.equal(r.verdictsByIndicator.get("8.8.8.8")?.[0].provider, "abuseipdb");
});

test("IP routing: explicit THREAT_INTEL_VIRUSTOTAL_IP_ENABLED -> VirusTotal also receives the IP", async () => {
  const rec = { urls: [] as string[] };
  const env = {
    THREAT_INTEL_EXTERNAL_LOOKUPS: "true",
    THREAT_INTEL_VIRUSTOTAL_ENABLED: "true",
    THREAT_INTEL_VIRUSTOTAL_IP_ENABLED: "true",
    VIRUSTOTAL_API_KEY: "k",
  };
  await dispatchProviderLookups([ipInd("8.8.8.8")], providers, ctx(env, recordingFetch(rec)));
  assert.ok(rec.urls.some((u) => u.includes("virustotal.com/api/v3/ip_addresses/")), "VT IP report only when opted in");
});

test("IP routing: url/domain VirusTotal behavior is unchanged (still handled)", async () => {
  const rec = { urls: [] as string[] };
  const env = { THREAT_INTEL_EXTERNAL_LOOKUPS: "true", THREAT_INTEL_VIRUSTOTAL_ENABLED: "true", VIRUSTOTAL_API_KEY: "k" };
  const dom: ExtractedIndicator = { type: "domain", value: "bad.xyz", normalizedValue: "bad.xyz", confidence: 0.9, privacyClass: "public", domain: "bad.xyz" };
  await dispatchProviderLookups([dom], providers, ctx(env, recordingFetch(rec)));
  assert.ok(rec.urls.some((u) => u.includes("virustotal.com/api/v3/domains/")), "VT still checks domains");
});
