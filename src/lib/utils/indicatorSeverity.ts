/**
 * UI-only severity classification for a single fraud-indicator string. Shared between the
 * SuspiciousIndicators badges and the analysis visual summary so the two never diverge.
 *
 * This is presentational (how strongly to flag an indicator in the UI), NOT a security control.
 * Unmatched indicators default to "Medium" — never "Low" — so real fraud signals that lack the
 * high-risk trigger words are not visually understated.
 */
export type IndicatorSeverity = "High" | "Medium";

export function classifyIndicatorSeverity(text: string): IndicatorSeverity {
  const norm = (text || "").toLowerCase();
  if (/critical|urgent|fake|phish|impersonat|momo/.test(norm)) return "High";
  return "Medium";
}
