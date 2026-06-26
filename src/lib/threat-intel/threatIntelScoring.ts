/** Aggregate provider verdicts into non-accusatory signals + a bounded risk contribution. Pure. */
import {
  AggregateStatus,
  ProviderVerdict,
  ThreatIntelSignal,
  ThreatRiskLabel,
  THREAT_INTEL_WORDING,
} from "./types";

/** A provider match increases risk but never confirms fraud; a no-match never means "safe". */
export function aggregateVerdicts(verdicts: ProviderVerdict[]): AggregateStatus {
  if (verdicts.length === 0) return "unknown";
  const matches = verdicts.filter((v) => v.status === "match");
  if (matches.length === 0) {
    return verdicts.some((v) => v.status === "no_match") ? "no_match_found" : "unknown";
  }
  const strong = matches.length >= 2 || matches.some((v) => v.confidence >= 0.6);
  return strong ? "possible_match" : "needs_verification";
}

export function riskLabelFromSignals(signals: ThreatIntelSignal[]): {
  label: ThreatRiskLabel;
  contribution: number;
} {
  let score = 0;
  for (const s of signals) {
    if (s.aggregateStatus === "possible_match") score += 0.4;
    else if (s.aggregateStatus === "needs_verification") score += 0.2;
  }
  const contribution = Math.min(1, score);
  let label: ThreatRiskLabel = "low";
  if (contribution >= 0.8) label = "critical";
  else if (contribution >= 0.6) label = "high";
  else if (contribution >= 0.4) label = "elevated";
  else if (contribution > 0) label = "caution";
  return { label, contribution };
}

export function userFacingSummary(signals: ThreatIntelSignal[]): string {
  const flagged = signals.filter(
    (s) => s.aggregateStatus === "possible_match" || s.aggregateStatus === "needs_verification",
  );
  if (flagged.length === 0) {
    return `No ${THREAT_INTEL_WORDING.externalSignal}s were found for the links in this evidence. ${THREAT_INTEL_WORDING.notSafeNote}`;
  }
  const items = flagged
    .map((s) => `${s.indicator.value} (${THREAT_INTEL_WORDING.possibleMatch}, ${THREAT_INTEL_WORDING.needsVerification})`)
    .join("; ");
  return `${flagged.length} ${THREAT_INTEL_WORDING.externalSignal}(s) need review: ${items}. These are possible matches that need verification, not confirmation of fraud.`;
}

/** Structured notes the analysis model MAY reference but must never invent. */
export function modelNotes(signals: ThreatIntelSignal[]): string {
  if (signals.length === 0) return "No indicators were extracted; no external reputation signals available.";
  const lines = signals.map((s) => {
    const why = s.verdicts.map((v) => `${v.provider}:${v.status}${v.rawScoreSummary ? ` (${v.rawScoreSummary})` : ""}`).join(", ");
    return `- ${s.indicator.type} ${s.indicator.value}: ${s.aggregateStatus} [${why || "no checks"}]`;
  });
  return ["External reputation signals (grounded; do not invent beyond these):", ...lines].join("\n");
}
