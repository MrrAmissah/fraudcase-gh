import { ExtractedEntities } from "./analysis";

/**
 * Result of a public, no-sign-up Quick Check scan.
 * Ephemeral: nothing about an anonymous Quick Check is persisted server-side.
 */
export interface QuickCheckResult {
  quickCheckId: string;
  scamCategory: string;
  riskScore: number; // 0-100
  confidence: "low" | "medium" | "high";
  shortSummary: string;
  possibleFraudIndicators: string[];
  extractedEntities: ExtractedEntities;
  redactionWarnings: string[];
  recommendedNextSteps: string[];
  saveAsCaseAvailable: boolean;
  shareRedactedSignalAvailable: boolean;
  disclaimer: string;
}
