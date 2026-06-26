/**
 * Dispatch enabled providers over extracted indicators. Server-side only. Enforces the
 * `do_not_send_external` privacy guard at dispatch time (not just as a label), runs only enabled
 * providers that support the indicator kind, is cache-first, and never throws.
 */
import { ExtractedIndicator, ProviderVerdict } from "./types";
import {
  LookupKind,
  ProviderLookupContext,
  ThreatIntelProvider,
  lookupWithTimeout,
  providerCacheKey,
} from "./providers/providerTypes";
import { ReputationCache } from "./reputationCache";

function kindForIndicator(type: ExtractedIndicator["type"]): LookupKind | null {
  if (type === "url") return "url";
  if (type === "domain") return "domain";
  if (type === "ip") return "ip";
  return null; // phones/emails/etc. are never sent to reputation providers
}

export interface DispatchResult {
  /** keyed by indicator.normalizedValue */
  verdictsByIndicator: Map<string, ProviderVerdict[]>;
  skippedForPrivacy: ExtractedIndicator[];
}

export async function dispatchProviderLookups(
  indicators: ExtractedIndicator[],
  providers: ThreatIntelProvider[],
  ctx: ProviderLookupContext,
  cache?: ReputationCache,
): Promise<DispatchResult> {
  const verdictsByIndicator = new Map<string, ProviderVerdict[]>();
  const skippedForPrivacy: ExtractedIndicator[] = [];
  const enabled = providers.filter((p) => p.isEnabled(ctx.env));

  for (const ind of indicators) {
    if (ind.privacyClass === "do_not_send_external") {
      skippedForPrivacy.push(ind);
      continue;
    }
    const kind = kindForIndicator(ind.type);
    if (!kind) continue;

    const verdicts: ProviderVerdict[] = [];
    for (const provider of enabled) {
      if (!provider.capabilities[kind]) continue;
      const key = providerCacheKey(provider.name, kind, ind.normalizedValue);
      const cached = cache?.get(key);
      if (cached) {
        verdicts.push(cached);
        continue;
      }
      const verdict = await lookupWithTimeout(provider, kind, ind.normalizedValue, ctx);
      cache?.set(key, verdict);
      verdicts.push(verdict);
    }
    if (verdicts.length) verdictsByIndicator.set(ind.normalizedValue, verdicts);
  }

  return { verdictsByIndicator, skippedForPrivacy };
}
