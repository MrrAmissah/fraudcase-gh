/**
 * AbuseIPDB CHECK-ONLY provider (server-side, disabled by default).
 *
 * Uses only the read-only `GET /api/v2/check` endpoint for accepted PUBLIC IPv4 indicators. It never
 * calls `POST /api/v2/report` (no reporting) and never submits anything. Only public IPs reach here
 * (the extractor excludes private/local/reserved/doc ranges; the dispatcher skips do_not_send_external).
 * A low/zero confidence score is `no_match` ("not found in this source"), never "safe".
 */
import { ProviderVerdict } from "../types";
import {
  LookupKind,
  ProviderLookupContext,
  ThreatIntelProvider,
  errorVerdict,
  flagEnabled,
  unavailableVerdict,
} from "./providerTypes";

const CHECK_ENDPOINT = "https://api.abuseipdb.com/api/v2/check";
/** Confidence (0-100) at/above which we surface a possible match. Below this is no_match (not "safe"). */
const MATCH_THRESHOLD = 25;

function configured(env: NodeJS.ProcessEnv): boolean {
  return Boolean((env.ABUSEIPDB_API_KEY || "").trim());
}

async function lookup(kind: LookupKind, value: string, ctx: ProviderLookupContext): Promise<ProviderVerdict> {
  const now = () => new Date().toISOString();
  if (kind !== "ip") return unavailableVerdict("abuseipdb", "unsupported indicator kind", now);
  const key = (ctx.env.ABUSEIPDB_API_KEY || "").trim();
  if (!key) return unavailableVerdict("abuseipdb", "not configured", now);

  try {
    const url = new URL(CHECK_ENDPOINT);
    url.searchParams.set("ipAddress", value);
    url.searchParams.set("maxAgeInDays", "90");
    // GET check only — the report endpoint is never used.
    const res = await ctx.fetchImpl(url.toString(), { method: "GET", headers: { Key: key, Accept: "application/json" } });
    if (!res.ok) return errorVerdict("abuseipdb", new Error(`HTTP ${res.status}`), now);

    const data = (await res.json()) as { data?: { abuseConfidenceScore?: number; totalReports?: number } };
    const score = Number(data?.data?.abuseConfidenceScore || 0);
    const reports = Number(data?.data?.totalReports || 0);
    if (score < MATCH_THRESHOLD) {
      return {
        provider: "abuseipdb",
        checkedAt: now(),
        status: "no_match",
        category: "unknown",
        confidence: 0,
        rawScoreSummary: "no significant abuse reports for this IP",
        cacheTtlSeconds: 3600,
      };
    }
    return {
      provider: "abuseipdb",
      checkedAt: now(),
      status: "match",
      category: "suspicious",
      confidence: Math.min(0.9, score / 100),
      rawScoreSummary: `AbuseIPDB confidence ${score}% across ${reports} report(s)`,
      cacheTtlSeconds: 3600,
    };
  } catch (err) {
    return errorVerdict("abuseipdb", err, now);
  }
}

export const abuseIpdbProvider: ThreatIntelProvider = {
  name: "abuseipdb",
  capabilities: { url: false, domain: false, ip: true, hash: false },
  isConfigured: configured,
  isEnabled: (env) => flagEnabled(env, "THREAT_INTEL_ABUSEIPDB_ENABLED") && configured(env),
  lookup,
};
