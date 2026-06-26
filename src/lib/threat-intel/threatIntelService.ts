/**
 * Threat-intel enrichment orchestrator (foundation).
 *
 * Runs ONLY network-free Tier-0 local heuristics for now. External providers (Safe Browsing,
 * VirusTotal) are intentionally not called here and stay disabled by default; indicators marked
 * `do_not_send_external` would never be sent to them. Wired into analysis behind THREAT_INTEL_ENABLED
 * in a follow-up.
 */
import { extractIndicators } from "./extractIndicators";
import { localHeuristicsVerdict } from "./providers/localHeuristicsProvider";
import { aggregateVerdicts, riskLabelFromSignals, userFacingSummary, modelNotes } from "./threatIntelScoring";
import { ExtractedIndicator, ProviderVerdict, ThreatIntelEnrichmentResult, ThreatIntelSignal } from "./types";
import { dispatchProviderLookups } from "./providerDispatch";
import { ThreatIntelProvider, providerTimeoutMs } from "./providers/providerTypes";
import { ReputationCache } from "./reputationCache";
import { ExternalLookupStatus } from "./riskSignalsViewModel";

/** Feature flag: only the literal "true" enables threat-intel (default OFF), mirroring other gates. */
export function isThreatIntelEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.THREAT_INTEL_ENABLED || "").trim().toLowerCase() === "true";
}

/** External lookups have their own, separate, also-default-off gate (no external provider built yet). */
export function isThreatIntelExternalEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.THREAT_INTEL_EXTERNAL_LOOKUPS || "").trim().toLowerCase() === "true";
}

export interface EnrichInput {
  /** Already-redacted evidence/accepted-fact text to scan for indicators. */
  text: string;
  sourceEvidenceId?: string;
}

/**
 * Compute reputation signals from redacted text. Pure + network-free (Tier 0). Never throws on bad
 * input; provider failures degrade gracefully. Does NOT itself check the feature flag — callers gate
 * invocation with {@link isThreatIntelEnabled} so analysis still works when the feature is off.
 */
export function enrichThreatIntel(input: EnrichInput): ThreatIntelEnrichmentResult {
  const indicators = extractIndicators(input?.text || "", input?.sourceEvidenceId);
  const signals: ThreatIntelSignal[] = [];
  const privacyWarnings: string[] = [];

  for (const ind of indicators) {
    const verdicts: ProviderVerdict[] = [];
    const local = localHeuristicsVerdict(ind);
    if (local) verdicts.push(local);

    // External providers are intentionally NOT invoked in this foundation. When they are, anything
    // classed do_not_send_external must remain internal-only.
    if (ind.privacyClass === "do_not_send_external") {
      privacyWarnings.push(`Withheld from external reputation providers (tokens/PII): ${ind.type} ${ind.value}`);
    }

    signals.push({ indicator: ind, verdicts, aggregateStatus: aggregateVerdicts(verdicts) });
  }

  const { label, contribution } = riskLabelFromSignals(signals);
  return {
    indicators,
    signals,
    riskLabel: label,
    riskContribution: contribution,
    userFacingSummary: userFacingSummary(signals),
    analysisNotesForModel: modelNotes(signals),
    privacyWarnings,
  };
}

export interface ExternalLookupDeps {
  /** Injected so tests run on mocks; nothing reaches the network unmocked. */
  fetchImpl: typeof fetch;
  providers: ThreatIntelProvider[];
  cache?: ReputationCache;
}

export interface ExternalLookupResult {
  status: ExternalLookupStatus;
  verdictsByIndicator: Map<string, ProviderVerdict[]>;
}

/**
 * Run external reputation providers over ALREADY-EXTRACTED, accepted-fact indicators.
 *
 * Gated: returns `not_checked` (and calls nothing) unless THREAT_INTEL_EXTERNAL_LOOKUPS is true AND at
 * least one provider is enabled (flag + key). `do_not_send_external` indicators are withheld by the
 * dispatcher. Never throws; provider failures degrade to `unavailable`. A no-match is reported as
 * `no_match` ("No external match returned"), never "safe".
 */
export async function runExternalLookups(
  indicators: ExtractedIndicator[],
  env: NodeJS.ProcessEnv,
  deps: ExternalLookupDeps,
): Promise<ExternalLookupResult> {
  const empty = new Map<string, ProviderVerdict[]>();
  if (!isThreatIntelExternalEnabled(env)) return { status: "not_checked", verdictsByIndicator: empty };

  const enabled = deps.providers.filter((p) => p.isEnabled(env));
  if (enabled.length === 0) return { status: "unavailable", verdictsByIndicator: empty };

  const ctx = { fetchImpl: deps.fetchImpl, timeoutMs: providerTimeoutMs(env), env };
  const { verdictsByIndicator } = await dispatchProviderLookups(indicators, enabled, ctx, deps.cache);

  const all = [...verdictsByIndicator.values()].flat();
  if (all.length === 0) return { status: "not_checked", verdictsByIndicator }; // nothing checkable
  if (all.some((v) => v.status === "match")) return { status: "match", verdictsByIndicator };
  if (all.some((v) => v.status === "no_match")) return { status: "no_match", verdictsByIndicator };
  return { status: "unavailable", verdictsByIndicator }; // only errors / rate limits
}
