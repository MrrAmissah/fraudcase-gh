export interface ExtractedEntities {
  phoneNumbers: string[];
  urls: string[];
  names: string[];
  organizations: string[];
  amounts: string[];
  dates: string[];
  transactionReferences: string[];
  locations: string[];
}

export interface TimelineEvent {
  date?: string;
  event: string;
  source?: string;
}

export interface ChecklistItem {
  item: string;
  status: "present" | "missing" | "unclear";
  note: string;
}

export interface FraudAnalysis {
  scamCategory:
    | "smishing"
    | "phishing"
    | "impersonation"
    | "fake_delivery"
    | "payment_dispute"
    | "fake_investment"
    | "romance_scam"
    | "account_takeover"
    | "unknown";
  confidence: "low" | "medium" | "high";
  riskScore: number; // 0 to 100
  shortSummary: string;
  suspiciousIndicators: string[];
  extractedEntities: ExtractedEntities;
  timeline: TimelineEvent[];
  evidenceChecklist: ChecklistItem[];
  recommendedNextSteps: string[];
  reportSummary: string;
  disclaimer: string;
  /** Which engine produced this analysis: the Gemini model, or the local heuristic fallback. */
  analysisProvider?: "gemini" | "heuristic";
}
