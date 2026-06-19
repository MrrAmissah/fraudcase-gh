export type EvidenceType =
  | "sms"
  | "whatsapp"
  | "email"
  | "url"
  | "receipt"
  | "screenshot"
  | "document"
  | "note";

export interface EvidenceItem {
  id: string;
  ownerId?: string;
  caseId: string;
  type: EvidenceType;
  title: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  storagePath?: string;
  fileUrl?: string;
  downloadUrl?: string;
  originalText?: string;
  extractedText?: string;
  redactedText?: string;
  redactionWarnings?: string[];
  detectedSensitiveTypes?: string[];
  createdAt: string;
  updatedAt?: string;
}
