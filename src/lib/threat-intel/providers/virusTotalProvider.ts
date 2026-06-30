/**
 * VirusTotal v3 PASSIVE lookups (server-side, disabled by default).
 *
 * Retrieves EXISTING reports via GET only: `/urls/{id}`, `/domains/{d}`, `/ip_addresses/{ip}`,
 * `/files/{hash}`. It never POSTs `/urls` (active submission) or `/files` (upload), so no user
 * evidence/URL is submitted for scanning. The dispatcher already withholds `do_not_send_external`
 * indicators. A 404 / zero detections means "no existing record", NOT that the indicator is safe.
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

const BASE = "https://www.virustotal.com/api/v3";

function configured(env: NodeJS.ProcessEnv): boolean {
  return Boolean((env.VIRUSTOTAL_API_KEY || "").trim());
}

/** VirusTotal URL id = unpadded URL-safe base64 of the URL. */
function urlId(url: string): string {
  return Buffer.from(url).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function passivePath(kind: LookupKind, value: string): string | null {
  switch (kind) {
    case "url": return `/urls/${urlId(value)}`;
    case "domain": return `/domains/${encodeURIComponent(value)}`;
    case "ip": return `/ip_addresses/${encodeURIComponent(value)}`;
    case "hash": return `/files/${encodeURIComponent(value)}`;
    default: return null;
  }
}

async function lookup(kind: LookupKind, value: string, ctx: ProviderLookupContext): Promise<ProviderVerdict> {
  const now = () => new Date().toISOString();
  const key = (ctx.env.VIRUSTOTAL_API_KEY || "").trim();
  if (!key) return unavailableVerdict("virustotal", "not configured", now);
  const path = passivePath(kind, value);
  if (!path) return unavailableVerdict("virustotal", "unsupported indicator kind", now);

  try {
    // GET only — passive report retrieval. No submission/upload endpoints are ever used.
    const res = await ctx.fetchImpl(`${BASE}${path}`, { method: "GET", headers: { "x-apikey": key } });
    if (res.status === 404) {
      return {
        provider: "virustotal",
        checkedAt: now(),
        status: "no_match",
        category: "unknown",
        confidence: 0,
        rawScoreSummary: "no existing VirusTotal record for this indicator",
        cacheTtlSeconds: 3600,
      };
    }
    if (!res.ok) return errorVerdict("virustotal", new Error(`HTTP ${res.status}`), now);

    const data = (await res.json()) as {
      data?: { attributes?: { last_analysis_stats?: { malicious?: number; suspicious?: number } } };
    };
    const stats = data?.data?.attributes?.last_analysis_stats || {};
    const malicious = Number(stats.malicious || 0);
    const suspicious = Number(stats.suspicious || 0);
    if (malicious + suspicious <= 0) {
      return {
        provider: "virustotal",
        checkedAt: now(),
        status: "no_match",
        category: "unknown",
        confidence: 0,
        rawScoreSummary: "no engines reported this indicator",
        cacheTtlSeconds: 3600,
      };
    }
    return {
      provider: "virustotal",
      checkedAt: now(),
      status: "match",
      category: "suspicious",
      confidence: Math.min(0.9, 0.4 + malicious * 0.1),
      rawScoreSummary: `VirusTotal reported ${malicious} malicious, ${suspicious} suspicious engine result(s)`,
      cacheTtlSeconds: 3600,
    };
  } catch (err) {
    return errorVerdict("virustotal", err, now);
  }
}

export const virusTotalProvider: ThreatIntelProvider = {
  name: "virustotal",
  capabilities: { url: true, domain: true, ip: true, hash: true },
  isConfigured: configured,
  isEnabled: (env) => flagEnabled(env, "THREAT_INTEL_VIRUSTOTAL_ENABLED") && configured(env),
  // IP lookups are gated behind a SEPARATE default-off flag, so VirusTotal does not start checking
  // public-IP indicators on a deploy. AbuseIPDB is the default IP provider.
  handlesKind: (kind, env) => (kind === "ip" ? flagEnabled(env, "THREAT_INTEL_VIRUSTOTAL_IP_ENABLED") : true),
  lookup,
};
