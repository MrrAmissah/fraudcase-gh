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

/** Group key so a URL and its derived domain (same host) are scored/listed once, not twice. */
function hostKey(s: ThreatIntelSignal): string {
  return s.indicator.domain || s.indicator.normalizedValue;
}

export function riskLabelFromSignals(signals: ThreatIntelSignal[]): {
  label: ThreatRiskLabel;
  contribution: number;
} {
  const rank: Record<string, number> = { possible_match: 2, needs_verification: 1 };
  // De-duplicate by host: take the strongest status per host so url+domain pairs don't double-count.
  const byHost = new Map<string, number>();
  for (const s of signals) {
    const r = rank[s.aggregateStatus] || 0;
    if (r === 0) continue;
    const key = hostKey(s);
    byHost.set(key, Math.max(byHost.get(key) || 0, r));
  }
  let score = 0;
  for (const r of byHost.values()) score += r === 2 ? 0.4 : 0.2;
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
  // De-duplicate by host (prefer the URL indicator's value) so one link isn't listed twice.
  const byHost = new Map<string, ThreatIntelSignal>();
  for (const s of flagged) {
    const key = hostKey(s);
    const existing = byHost.get(key);
    if (!existing || (s.indicator.type === "url" && existing.indicator.type !== "url")) byHost.set(key, s);
  }
  const unique = [...byHost.values()];
  if (unique.length === 0) {
    return `No ${THREAT_INTEL_WORDING.externalSignal}s were found for the links in this evidence. ${THREAT_INTEL_WORDING.notSafeNote}`;
  }
  const items = unique
    .map((s) => `${s.indicator.value} (${THREAT_INTEL_WORDING.possibleMatch}, ${THREAT_INTEL_WORDING.needsVerification})`)
    .join("; ");
  return `${unique.length} ${THREAT_INTEL_WORDING.externalSignal}(s) need review: ${items}. These are possible matches that need verification, not confirmation of fraud.`;
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
