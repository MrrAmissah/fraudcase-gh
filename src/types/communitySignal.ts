import { ExtractedEntities } from "./analysis";

export type ReviewedStatus = "pending" | "reviewed" | "false_positive" | "useful";

/** A stored, redacted community fraud signal (see communitySignals collection). */
export interface CommunitySignal {
  id: string;
  source: string;
  consentGiven: boolean;
  redactedText: string;
  scamCategory: string;
  riskScore: number;
  confidence: string;
  possibleFraudIndicators: string[];
  extractedEntities: ExtractedEntities;
  normalizedDomain: string | null;
  normalizedSender: string | null;
  maskedPhone: string | null;
  amountRequested: string | null;
  countryContext: string;
  createdAt: string;
  reviewedStatus: ReviewedStatus;
  clusterId: string | null;
  userId: string | null;
  rawFileStored: boolean;
  adminNote?: string;
  updatedAt?: string;
  // Not stored by Phase 3 today; rendered only if present on a signal.
  recommendedNextSteps?: string[];
}

export interface CommunitySignalStats {
  total: number;
  pending: number;
  reviewed: number;
  falsePositive: number;
  useful: number;
  highRisk: number;
}

export interface CommunitySignalsResponse {
  stats: CommunitySignalStats;
  signals: CommunitySignal[];
}
