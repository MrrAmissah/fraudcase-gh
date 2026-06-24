/**
 * Pure presentation view-model for the Sprint 4 verification workspace.
 *
 * Critical invariant (Decision 2): grounding strength is NOT trust. `high_confidence_suggested`
 * must render as a suggestion, never as an "accepted/verified" tone. Only user acceptance
 * (`accepted`/`edited`, i.e. `isTrustedFact`) is trusted. `verification` and `confidence` are shown
 * as subordinate "AI signals", never as a trust verdict. This logic is unit-tested so the UI cannot
 * silently contradict the backend contract.
 */
import {
  isTrustedFact,
  type ExtractedArtifact,
  type ExtractedFact,
  type ExtractedFactType,
  type VerificationMatch,
} from "./types";

export type BadgeTone = "trusted" | "suggested" | "caution" | "rejected";

export interface FactBadge {
  label: string;
  tone: BadgeTone;
  isTrusted: boolean;
}

/** Authoritative status badge. The user decision dominates; grounding strength never reads trusted. */
export function factStatusBadge(
  fact: Pick<ExtractedFact, "verificationStatus" | "verifiedByUser">,
): FactBadge {
  if (isTrustedFact(fact)) {
    return { label: "Accepted by you", tone: "trusted", isTrusted: true };
  }
  if (fact.verificationStatus === "rejected") {
    return { label: "Rejected", tone: "rejected", isTrusted: false };
  }
  if (fact.verificationStatus === "needs_review") {
    return { label: "Needs your review", tone: "caution", isTrusted: false };
  }
  // "suggested" AND "high_confidence_suggested" are both untrusted suggestions.
  return { label: "Suggested by AI", tone: "suggested", isTrusted: false };
}

/** Subordinate "AI signal" label for grounding strength. Never a trust verdict. */
export function factGroundingLabel(v: VerificationMatch): string {
  switch (v) {
    case "exact_match":
      return "AI grounding: exact match in evidence";
    case "normalized_match":
      return "AI grounding: normalized match";
    case "weak_match":
      return "AI grounding: weak match";
    default:
      return "AI grounding: not found in evidence";
  }
}

/** Subordinate "AI signal" label for model confidence. */
export function factConfidenceLabel(confidence: number): string {
  const c = typeof confidence === "number" ? confidence : 0;
  const band = c >= 0.85 ? "high" : c >= 0.6 ? "medium" : "low";
  return `AI confidence: ${band} (${Math.round(c * 100)}%)`;
}

const FACT_TYPE_LABELS: Record<ExtractedFactType, string> = {
  phone_number: "Phone number",
  url: "Link / URL",
  amount: "Amount",
  transaction_ref: "Transaction reference",
  person_name: "Name",
  organization: "Organization",
  date: "Date",
  time: "Time",
  otp_request: "OTP request",
  payment_request: "Payment request",
};

export function factTypeLabel(t: ExtractedFactType): string {
  return FACT_TYPE_LABELS[t] || t;
}

export type ExtractionUiState =
  | "not_applicable" // text/url/non-image-or-pdf evidence: no extraction control
  | "none" // extractable, not yet extracted
  | "in_progress"
  | "extracted" // has at least one grounded fact
  | "extracted_no_facts" // ran, but nothing groundable was found
  | "failed"
  | "timeout";

export interface ExtractableItem {
  fileName?: string;
  fileType?: string;
  extractionStatus?: string;
  extractedArtifact?: ExtractedArtifact;
}

/** MVP extractable surface: a stored PNG/JPEG image or a PDF. webp/text are excluded (match backend). */
export function isExtractable(item: ExtractableItem): boolean {
  if (!item.fileName) return false;
  const ft = (item.fileType || "").toLowerCase();
  return ft === "image/png" || ft === "image/jpeg" || ft === "image/pjpeg" || ft === "application/pdf";
}

export function extractionUiState(item: ExtractableItem): ExtractionUiState {
  if (!isExtractable(item)) return "not_applicable";
  switch (item.extractionStatus) {
    case "failed":
      return "failed";
    case "timeout":
      return "timeout";
    case "running":
    case "queued":
      return "in_progress";
    case "extracted": {
      const facts = item.extractedArtifact?.facts || [];
      return facts.length > 0 ? "extracted" : "extracted_no_facts";
    }
    default:
      return "none";
  }
}

export interface FactCounts {
  total: number;
  accepted: number;
  rejected: number;
  pending: number;
}

export function factCounts(artifact?: ExtractedArtifact): FactCounts {
  const facts = artifact?.facts || [];
  const accepted = facts.filter(isTrustedFact).length;
  const rejected = facts.filter((f) => f.verificationStatus === "rejected").length;
  return {
    total: facts.length,
    accepted,
    rejected,
    pending: facts.length - accepted - rejected,
  };
}

/** Order facts so the ones needing attention surface first; accepted/rejected sink. */
export function orderedFacts(artifact?: ExtractedArtifact): ExtractedFact[] {
  const rank = (f: ExtractedFact): number => {
    if (f.verificationStatus === "needs_review") return 0;
    if (!isTrustedFact(f) && f.verificationStatus !== "rejected") return 1; // suggested
    if (isTrustedFact(f)) return 2; // accepted
    return 3; // rejected
  };
  return [...(artifact?.facts || [])].sort((a, b) => rank(a) - rank(b));
}
