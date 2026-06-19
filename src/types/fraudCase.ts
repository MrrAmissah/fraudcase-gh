import { EvidenceItem } from "./evidence";
import { FraudAnalysis } from "./analysis";

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
}
