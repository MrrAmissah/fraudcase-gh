/**
 * Source mapping + analysis-input assembly (Sprint 3, Decision 2).
 *
 * The case analyzer (`analyzeFraudCase`) reads each evidence item's `redactedText`/`originalText`.
 * Extraction output is written ONLY to `extractedArtifact`, never to those fields, so an image/PDF
 * item contributes nothing to analysis on its own. This module turns ONLY user-accepted facts into
 * synthetic redacted evidence items that the analyze route appends. Unaccepted suggestions and
 * rejected facts never reach pass B.
 */
import type { EvidenceItem } from "../../types/evidence";
import { isTrustedFact, type AnalysisInputBundle } from "./types";

/** Build the inspectable bundle. Accepted facts only; artifact text only when >= 1 fact accepted. */
export function buildAnalysisInputBundle(
  caseId: string,
  ownerId: string,
  evidenceItems: EvidenceItem[],
): AnalysisInputBundle {
  const builtAt = new Date().toISOString();
  const items: AnalysisInputBundle["items"] = [];
  const originalTextEvidence: AnalysisInputBundle["originalTextEvidence"] = [];

  let acceptedFactCount = 0;
  let visualSignalCount = 0;
  let requiresHumanReview = false;

  for (const item of evidenceItems || []) {
    if (item.extractedArtifact) {
      const artifact = item.extractedArtifact;
      const acceptedFacts = artifact.facts.filter(isTrustedFact);
      acceptedFactCount += acceptedFacts.length;
      visualSignalCount += artifact.visualSignals.length;
      if (artifact.requiresHumanReview) requiresHumanReview = true;
      items.push({
        evidenceId: item.id,
        sourceType: artifact.sourceType,
        // Inspection metadata only — NOT analysis input. Analysis consumes accepted facts (see
        // bundleToAnalysisEvidenceItems / acceptedFactsText), so unaccepted OCR never reaches pass B.
        redactedText: acceptedFacts.length > 0 ? artifact.redactedText : undefined,
        acceptedFacts,
      });
    } else {
      const text = item.redactedText || item.originalText || "";
      if (text.trim()) originalTextEvidence.push({ evidenceId: item.id, redactedText: text });
    }
  }

  return {
    caseId,
    ownerId,
    builtAt,
    items,
    originalTextEvidence,
    multimodalEvidenceSummary: {
      evidenceCount: items.length,
      acceptedFactCount,
      visualSignalCount,
      requiresHumanReview,
      notes: ["Only user-accepted extracted facts are used as analysis input."],
    },
  };
}

/**
 * Text built from ONLY user-accepted facts' redacted values — the safe input for threat-intel
 * enrichment. Deliberately excludes `redactedText` (which contains unaccepted artifact text), so
 * indicators are never extracted from suggestions/rejected content.
 */
export function acceptedFactsText(bundle: AnalysisInputBundle): string {
  const values: string[] = [];
  for (const it of bundle.items) {
    for (const f of it.acceptedFacts) {
      if (f.redactedValue && f.redactedValue.trim()) values.push(f.redactedValue);
    }
  }
  return values.join("\n");
}

/**
 * Convert the bundle into synthetic redacted evidence items carrying ONLY user-accepted extracted
 * content. The analyze route appends these to the case's existing text evidence before pass B.
 */
export function bundleToAnalysisEvidenceItems(bundle: AnalysisInputBundle): EvidenceItem[] {
  return bundle.items
    .filter((it) => it.acceptedFacts.length > 0)
    .map((it) => {
      // Accepted facts ONLY — never the full artifact transcript. Including `redactedText` would leak
      // unaccepted OCR (unsupported claims, embedded "ignore instructions" text) into pass B, breaking
      // the Decision 2 no-auto-trust gate. Only user-accepted facts feed analysis.
      const lines = it.acceptedFacts.map((f) => `${f.type}: ${f.redactedValue}`).filter((l) => l.trim());
      return {
        id: `xfacts-${it.evidenceId}`,
        caseId: bundle.caseId,
        type: "note",
        title: "User-accepted extracted facts",
        redactedText: lines.join("\n"),
        createdAt: bundle.builtAt,
      } as EvidenceItem;
    });
}
