/**
 * Google Web Risk passive URL lookup (server-side, disabled by default).
 *
 * Uses the read-only `v1/uris:search` endpoint (a lookup, never a submission). Only accepted URL
 * indicators reach here (the dispatcher skips `do_not_send_external`). An empty response means the
 * URL was not on the requested lists — NOT that it is safe. No raw evidence, files, or PII are sent.
 */
import { ProviderVerdict, VerdictCategory } from "../types";
import {
  LookupKind,
  ProviderLookupContext,
  ThreatIntelProvider,
  errorVerdict,
  flagEnabled,
  unavailableVerdict,
} from "./providerTypes";

const ENDPOINT = "https://webrisk.googleapis.com/v1/uris:search";
const THREAT_TYPES = ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"];

function configured(env: NodeJS.ProcessEnv): boolean {
  return Boolean((env.GOOGLE_WEB_RISK_API_KEY || "").trim());
}

function expireToTtlSeconds(expireTime: string | undefined): number {
  if (!expireTime) return 3600;
  const ms = Date.parse(expireTime) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 3600;
  return Math.min(86400, Math.floor(ms / 1000));
}

async function lookup(kind: LookupKind, value: string, ctx: ProviderLookupContext): Promise<ProviderVerdict> {
  const now = () => new Date().toISOString();
  if (kind !== "url") return unavailableVerdict("web_risk", "unsupported indicator kind", now);
  const key = (ctx.env.GOOGLE_WEB_RISK_API_KEY || "").trim();
  if (!key) return unavailableVerdict("web_risk", "not configured", now);

  try {
    const url = new URL(ENDPOINT);
    url.searchParams.set("key", key);
    url.searchParams.set("uri", value);
    for (const t of THREAT_TYPES) url.searchParams.append("threatTypes", t);

    const res = await ctx.fetchImpl(url.toString(), { method: "GET" });
    if (!res.ok) return errorVerdict("web_risk", new Error(`HTTP ${res.status}`), now);

    const data = (await res.json()) as { threat?: { threatTypes?: string[]; expireTime?: string } };
    const types = data?.threat?.threatTypes;
    if (!Array.isArray(types) || types.length === 0) {
      return {
        provider: "web_risk",
        checkedAt: now(),
        status: "no_match",
        category: "unknown",
        confidence: 0,
        rawScoreSummary: "no match on the requested Web Risk lists",
        cacheTtlSeconds: 3600,
      };
    }
    const category: VerdictCategory = types.includes("SOCIAL_ENGINEERING")
      ? "social_engineering"
      : types.includes("MALWARE")
        ? "malware"
        : "suspicious";
    return {
      provider: "web_risk",
      checkedAt: now(),
      status: "match",
      category,
      confidence: 0.8,
      rawScoreSummary: `Web Risk reported: ${types.join(", ")}`,
      cacheTtlSeconds: expireToTtlSeconds(data?.threat?.expireTime),
    };
  } catch (err) {
    return errorVerdict("web_risk", err, now);
  }
}

export const webRiskProvider: ThreatIntelProvider = {
  name: "web_risk",
  capabilities: { url: true, domain: false, ip: false, hash: false },
  isConfigured: configured,
  isEnabled: (env) => flagEnabled(env, "THREAT_INTEL_WEB_RISK_ENABLED") && configured(env),
  lookup,
};
