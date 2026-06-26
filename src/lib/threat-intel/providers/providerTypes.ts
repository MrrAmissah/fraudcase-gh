/**
 * Provider-agnostic threat-intel interface + service helpers.
 *
 * Every provider is server-side only, disabled by default, and receives an injected `fetchImpl` so
 * tests run on mocks and a provider cannot reach the network unless explicitly wired. Providers must
 * never be called for `do_not_send_external` indicators (enforced by the dispatcher, not just labels).
 */
import { ProviderVerdict, ReputationProviderName } from "../types";

export type LookupKind = "url" | "domain" | "ip" | "hash";

export interface ProviderCapabilities {
  url: boolean;
  domain: boolean;
  ip: boolean;
  hash: boolean;
}

export interface ProviderLookupContext {
  /** Injected fetch — tests pass a mock; nothing reaches the network unmocked. */
  fetchImpl: typeof fetch;
  timeoutMs: number;
  env: NodeJS.ProcessEnv;
}

export interface ThreatIntelProvider {
  readonly name: ReputationProviderName;
  readonly capabilities: ProviderCapabilities;
  /** Key present in env (independent of the enable flag). */
  isConfigured(env: NodeJS.ProcessEnv): boolean;
  /** Enabled = provider flag is "true" AND configured. */
  isEnabled(env: NodeJS.ProcessEnv): boolean;
  /** Passive lookup. Must never throw; returns an error/rate_limited verdict on failure. */
  lookup(kind: LookupKind, normalizedValue: string, ctx: ProviderLookupContext): Promise<ProviderVerdict>;
}

export const DEFAULT_PROVIDER_TIMEOUT_MS = 4000;

export function providerTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number((env.THREAT_INTEL_PROVIDER_TIMEOUT_MS || "").trim());
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PROVIDER_TIMEOUT_MS;
}

/** Only the literal "true" enables a flag (matches the rest of the app's gates). */
export function flagEnabled(env: NodeJS.ProcessEnv, name: string): boolean {
  return (env[name] || "").trim().toLowerCase() === "true";
}

export function providerCacheKey(provider: ReputationProviderName, kind: LookupKind, normalizedValue: string): string {
  return `${provider}:${kind}:${normalizedValue}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Normalize any thrown/aborted error into a non-throwing verdict (rate_limited vs error). */
export function errorVerdict(provider: ReputationProviderName, err: unknown, now: () => string = nowIso): ProviderVerdict {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const rateLimited = msg.includes("429") || msg.includes("rate limit") || msg.includes("quota") || msg.includes("resource_exhausted");
  return {
    provider,
    checkedAt: now(),
    status: rateLimited ? "rate_limited" : "error",
    category: "unknown",
    confidence: 0,
    rawScoreSummary: rateLimited ? "provider rate-limited" : "provider lookup failed",
    cacheTtlSeconds: 60,
  };
}

/** Configured-but-not-run verdict (disabled, unsupported kind, or skipped for privacy). */
export function unavailableVerdict(provider: ReputationProviderName, reason: string, now: () => string = nowIso): ProviderVerdict {
  return { provider, checkedAt: now(), status: "unknown", category: "unknown", confidence: 0, rawScoreSummary: reason, cacheTtlSeconds: 60 };
}

/** Run a provider lookup under a hard timeout, converting any failure into a safe verdict. */
export async function lookupWithTimeout(
  provider: ThreatIntelProvider,
  kind: LookupKind,
  normalizedValue: string,
  ctx: ProviderLookupContext,
): Promise<ProviderVerdict> {
  const timeout = new Promise<ProviderVerdict>((resolve) =>
    setTimeout(() => resolve(errorVerdict(provider.name, new Error("timeout"))), ctx.timeoutMs),
  );
  try {
    return await Promise.race([provider.lookup(kind, normalizedValue, ctx), timeout]);
  } catch (err) {
    return errorVerdict(provider.name, err);
  }
}
