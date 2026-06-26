import { EvidenceItem } from "./evidence";
import { FraudAnalysis } from "./analysis";
import { RiskSignalsViewModel } from "../lib/threat-intel/riskSignalsViewModel";

export type CaseStatus = "draft" | "analyzed" | "reviewed" | "exported";

export interface FraudCase {
  id: string;
  title: string;
  description: string;
  status: CaseStatus;
  incidentDate?: string;
  createdAt: string;
  updatedAt: string;
  evidenceItems: EvidenceItem[];
  analysis?: FraudAnalysis;
  /** Tier-0 threat-intel risk signals (present only when THREAT_INTEL_ENABLED). */
  riskSignals?: RiskSignalsViewModel;
}
