/**
 * UI-ready "Risk signals" view-model. Serializable (used in the analysis API response + rendered by
 * the panel). Local heuristics are labeled as LOCAL indicators; external reputation is a separate
 * section that reads "Not checked" until a provider is enabled and returns a result.
 */
import {
  AggregateStatus,
  IndicatorType,
  ProviderVerdict,
  ReputationProviderName,
  ThreatIntelEnrichmentResult,
  ThreatRiskLabel,
  THREAT_INTEL_WORDING,
} from "./types";

export type RiskSignalSourceType = "local_heuristic" | "external_provider";
export type ExternalLookupStatus = "not_checked" | "unavailable" | "no_match" | "match" | "error";
export type RiskSeverity = "info" | "caution" | "elevated" | "high";

export interface RiskSignalView {
  id: string;
  indicatorType: IndicatorType;
  sourceType: RiskSignalSourceType;
  provider?: ReputationProviderName;
  severity: RiskSeverity;
  confidence: number;
  /** Already-redacted/token-stripped value, safe to display. */
  safeDisplayValue: string;
  explanation: string;
}

export interface RiskSignalsViewModel {
  enabled: boolean;
  localIndicators: RiskSignalView[];
  external: { status: ExternalLookupStatus; label: string; signals: RiskSignalView[] };
  riskLabel: ThreatRiskLabel;
  summary: string;
  privacyWarnings: string[];
  generatedAt: string;
}

function severityFromStatus(status: AggregateStatus): RiskSeverity {
  if (status === "possible_match") return "elevated";
  if (status === "needs_verification") return "caution";
  return "info";
}

function externalLabel(status: ExternalLookupStatus): string {
  switch (status) {
    case "not_checked": return THREAT_INTEL_WORDING.notChecked;
    case "unavailable": return THREAT_INTEL_WORDING.unavailable;
    case "no_match": return THREAT_INTEL_WORDING.noExternalMatch;
    case "match": return THREAT_INTEL_WORDING.providerMatch;
    default: return THREAT_INTEL_WORDING.unavailable;
  }
}

export function buildRiskSignalsViewModel(
  result: ThreatIntelEnrichmentResult,
  opts: {
    enabled?: boolean;
    externalStatus?: ExternalLookupStatus;
    /** Provider verdicts keyed by indicator.normalizedValue (from runExternalLookups). */
    externalVerdicts?: Map<string, ProviderVerdict[]>;
    now?: () => string;
  } = {},
): RiskSignalsViewModel {
  const now = opts.now || (() => new Date().toISOString());
  const externalStatus: ExternalLookupStatus = opts.externalStatus || "not_checked";
  const localIndicators: RiskSignalView[] = [];
  const seenMatchHosts = new Set<string>();

  for (const s of result.signals) {
    const host = s.indicator.domain || s.indicator.normalizedValue;
    const local = s.verdicts.find((v) => v.provider === "local_heuristics" && v.status === "match");
    if (local && !seenMatchHosts.has(host)) {
      seenMatchHosts.add(host);
      localIndicators.push({
        id: `local-${s.indicator.type}-${host}`,
        indicatorType: s.indicator.type,
        sourceType: "local_heuristic",
        severity: severityFromStatus(s.aggregateStatus),
        confidence: local.confidence,
        safeDisplayValue: s.indicator.value,
        explanation: local.rawScoreSummary || THREAT_INTEL_WORDING.localIndicator,
      });
    }
    if (s.indicator.privacyClass === "do_not_send_external") {
      const id = `local-dnse-${s.indicator.type}-${host}`;
      if (!localIndicators.some((x) => x.id === id)) {
        localIndicators.push({
          id,
          indicatorType: s.indicator.type,
          sourceType: "local_heuristic",
          severity: "info",
          confidence: s.indicator.confidence,
          safeDisplayValue: s.indicator.value,
          explanation: "Contains tokens or personal data — checked locally only; never sent to external providers.",
        });
      }
    }
  }

  // Map provider MATCH verdicts into external signals (labeled by provider, non-accusatory).
  const indicatorByValue = new Map(result.indicators.map((i) => [i.normalizedValue, i]));
  const externalSignals: RiskSignalView[] = [];
  if (opts.externalVerdicts) {
    for (const [normValue, verdicts] of opts.externalVerdicts) {
      for (const v of verdicts) {
        if (v.status !== "match") continue;
        const ind = indicatorByValue.get(normValue);
        externalSignals.push({
          id: `ext-${v.provider}-${normValue}`,
          indicatorType: ind?.type || "url",
          sourceType: "external_provider",
          provider: v.provider,
          severity: v.confidence >= 0.7 ? "high" : "elevated",
          confidence: v.confidence,
          safeDisplayValue: ind?.value || normValue,
          explanation: v.rawScoreSummary || THREAT_INTEL_WORDING.providerMatch,
        });
      }
    }
  }

  return {
    enabled: opts.enabled ?? true,
    localIndicators,
    external: { status: externalStatus, label: externalLabel(externalStatus), signals: externalSignals },
    riskLabel: result.riskLabel,
    summary: result.userFacingSummary,
    privacyWarnings: result.privacyWarnings,
    generatedAt: now(),
  };
}
